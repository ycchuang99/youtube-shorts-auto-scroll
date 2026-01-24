document.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.getElementById('toggleButton')
  const status = document.getElementById('status')
  
  // Load saved state
  const { enabled = true } = await chrome.storage.sync.get('enabled')
  toggle.checked = enabled
  updateStatus(enabled)

  // Handle toggle changes
  toggle.addEventListener('change', async () => {
    const enabled = toggle.checked
    
    // Save state
    await chrome.storage.sync.set({ enabled })
    updateStatus(enabled)
    
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

  function updateStatus(enabled) {
    if (enabled) {
      status.textContent = '✓ Enabled'
      status.className = 'status status-enabled'
    } else {
      status.textContent = '○ Disabled'
      status.className = 'status status-disabled'
    }
  }
})
