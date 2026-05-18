document.addEventListener('DOMContentLoaded', async () => {
  const PLAYBACK_SPEED_OPTIONS = [0.5, 0.75, 1, 1.5, 2]
  const toggle = document.getElementById('toggleButton')
  const adSkipToggle = document.getElementById('adSkipToggle')
  const playbackSpeedSlider = document.getElementById('playbackSpeedSlider')
  const playbackSpeedValue = document.getElementById('playbackSpeedValue')
  
  // Load saved state
  const { enabled = true, adSkipEnabled = true, playbackSpeed = 1 } = await chrome.storage.sync.get(['enabled', 'adSkipEnabled', 'playbackSpeed'])
  toggle.checked = enabled
  adSkipToggle.checked = adSkipEnabled
  playbackSpeedSlider.value = String(getPlaybackSpeedSliderIndex(playbackSpeed))
  updatePlaybackSpeedDisplay()

  // Handle auto-scroll toggle changes
  toggle.addEventListener('change', async () => {
    const enabled = toggle.checked
    
    // Save state
    await chrome.storage.sync.set({ enabled })
    
    // Notify content script (silently fail if not on YouTube)
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      await chrome.tabs.sendMessage(tab.id, { 
        action: 'toggleAutoScroll',
        enabled 
      })
    } catch (err) {
      // Silently ignore - content script might not be loaded
    }
  })

  // Handle ad skip toggle changes
  adSkipToggle.addEventListener('change', async () => {
    const enabled = adSkipToggle.checked
    
    // Save state
    await chrome.storage.sync.set({ adSkipEnabled: enabled })
    
    // Notify content script (silently fail if not on YouTube)
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      await chrome.tabs.sendMessage(tab.id, { 
        action: 'toggleAdSkip',
        enabled 
      })
    } catch (err) {
      // Silently ignore - content script might not be loaded
    }
  })

  // Handle playback speed changes
  playbackSpeedSlider.addEventListener('input', updatePlaybackSpeedDisplay)

  playbackSpeedSlider.addEventListener('change', async () => {
    const playbackSpeed = getPlaybackSpeedFromSliderValue(playbackSpeedSlider.value)
    playbackSpeedSlider.value = String(getPlaybackSpeedSliderIndex(playbackSpeed))
    updatePlaybackSpeedDisplay()
    
    // Save state
    await chrome.storage.sync.set({ playbackSpeed })
    
    // Notify content script (silently fail if not on YouTube)
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      await chrome.tabs.sendMessage(tab.id, {
        action: 'setPlaybackSpeed',
        playbackSpeed
      })
    } catch (err) {
      // Silently ignore - content script might not be loaded
    }
  })

  function normalizePopupPlaybackSpeed(value) {
    const speed = Number(value)
    if (!Number.isFinite(speed)) {
      return 1
    }

    return PLAYBACK_SPEED_OPTIONS.reduce((closestSpeed, option) => {
      return Math.abs(option - speed) < Math.abs(closestSpeed - speed) ? option : closestSpeed
    }, PLAYBACK_SPEED_OPTIONS[0])
  }

  function getPlaybackSpeedSliderIndex(value) {
    return PLAYBACK_SPEED_OPTIONS.indexOf(normalizePopupPlaybackSpeed(value))
  }

  function getPlaybackSpeedFromSliderValue(value) {
    const index = Number(value)
    if (!Number.isInteger(index) || index < 0 || index >= PLAYBACK_SPEED_OPTIONS.length) {
      return 1
    }

    return PLAYBACK_SPEED_OPTIONS[index]
  }

  function formatPlaybackSpeed(value) {
    return `${Number(value).toFixed(2).replace(/\.00$/, '').replace(/0$/, '')}x`
  }

  function updatePlaybackSpeedDisplay() {
    playbackSpeedValue.textContent = formatPlaybackSpeed(getPlaybackSpeedFromSliderValue(playbackSpeedSlider.value))
  }
})
