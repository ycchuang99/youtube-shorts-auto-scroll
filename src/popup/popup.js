document.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.getElementById('toggleButton')
  const adSkipToggle = document.getElementById('adSkipToggle')
  const status = document.getElementById('status')
  
  // Load saved state
  const { enabled = true, adSkipEnabled = true } = await chrome.storage.sync.get(['enabled', 'adSkipEnabled'])
  toggle.checked = enabled
  adSkipToggle.checked = adSkipEnabled
  updateStatus(enabled, adSkipEnabled)

  // Handle auto-scroll toggle changes
  toggle.addEventListener('change', async () => {
    const enabled = toggle.checked
    
    // Save state
    await chrome.storage.sync.set({ enabled })
    updateStatus(enabled, adSkipToggle.checked)
    
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
    updateStatus(toggle.checked, enabled)
    
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

  function updateStatus(autoScrollEnabled, adSkipEnabled) {
    let statusText = '';
    if (autoScrollEnabled && adSkipEnabled) {
      statusText = '✓ Both enabled';
    } else if (autoScrollEnabled) {
      statusText = '✓ Auto scroll enabled';
    } else if (adSkipEnabled) {
      statusText = '✓ Ad skip enabled';
    } else {
      statusText = '○ Both disabled';
    }
    
    status.textContent = statusText;
    
    if (autoScrollEnabled || adSkipEnabled) {
      status.className = 'status status-enabled'
    } else {
      status.className = 'status status-disabled'
    }
  }
})

