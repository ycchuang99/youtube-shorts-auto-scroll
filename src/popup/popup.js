document.addEventListener('DOMContentLoaded', async () => {
  const PLAYBACK_SPEED_OPTIONS = [0.5, 0.75, 1, 1.5, 2]
  const toggle = document.getElementById('toggleButton')
  const adSkipToggle = document.getElementById('adSkipToggle')
  const playbackSpeedSlider = document.getElementById('playbackSpeedSlider')
  const playbackSpeedValue = document.getElementById('playbackSpeedValue')

  document.documentElement.lang = chrome.i18n.getMessage('@@ui_locale').replace(/_/g, '-') || 'en'
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = chrome.i18n.getMessage(element.dataset.i18n) || element.textContent
  })
  document.querySelectorAll('[data-speed]').forEach((element) => {
    element.textContent = formatPlaybackSpeed(element.dataset.speed)
  })

  // Load saved state
  const { enabled = true, adSkipEnabled = true, playbackSpeed = 1 } = await chrome.storage.sync.get(['enabled', 'adSkipEnabled', 'playbackSpeed'])
  toggle.checked = enabled
  adSkipToggle.checked = adSkipEnabled
  playbackSpeedSlider.value = String(getPlaybackSpeedSliderIndex(playbackSpeed))
  updatePlaybackSpeedDisplay()

  // Handle auto-scroll toggle changes
  toggle.addEventListener('change', () => {
    const enabled = toggle.checked
    return saveAndNotify({ enabled }, { action: 'toggleAutoScroll', enabled })
  })

  // Handle ad skip toggle changes
  adSkipToggle.addEventListener('change', () => {
    const enabled = adSkipToggle.checked
    return saveAndNotify({ adSkipEnabled: enabled }, { action: 'toggleAdSkip', enabled })
  })

  // Handle playback speed changes
  playbackSpeedSlider.addEventListener('input', updatePlaybackSpeedDisplay)

  playbackSpeedSlider.addEventListener('change', () => {
    const playbackSpeed = getPlaybackSpeedFromSliderValue(playbackSpeedSlider.value)
    playbackSpeedSlider.value = String(getPlaybackSpeedSliderIndex(playbackSpeed))
    updatePlaybackSpeedDisplay()
    return saveAndNotify({ playbackSpeed }, { action: 'setPlaybackSpeed', playbackSpeed })
  })

  async function saveAndNotify(settings, message) {
    await chrome.storage.sync.set(settings)
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.id != null) await chrome.tabs.sendMessage(tab.id, message)
    } catch (err) {
      // Silently ignore - content script might not be loaded
    }
  }

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
    return chrome.i18n.getMessage('speedValue', String(value)) || `${value}x`
  }

  function updatePlaybackSpeedDisplay() {
    playbackSpeedValue.textContent = formatPlaybackSpeed(getPlaybackSpeedFromSliderValue(playbackSpeedSlider.value))
    playbackSpeedSlider.setAttribute('aria-valuetext', playbackSpeedValue.textContent)
  }
})
