// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.getElementById('toggleButton');
  
  try {
    // Get current tab to check if we're on YouTube Shorts
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isYouTubeShorts = tab?.url?.includes('youtube.com/shorts');

    if (!isYouTubeShorts) {
      toggle.disabled = true;
      
      return;
    }

    // Load saved state
    const { enabled = true } = await chrome.storage.sync.get('enabled');
    toggle.checked = enabled;

    // Handle toggle changes
    toggle.addEventListener('change', async () => {
      const enabled = toggle.checked;
      
      // Save state
      await chrome.storage.sync.set({ enabled });
      
      // Notify content script
      try {
        await chrome.tabs.sendMessage(tab.id, { 
          action: 'toggleAutoScroll',
          enabled 
        });
      } catch (err) {
        // If content script isn't ready, disable toggle
        toggle.checked = !enabled;
        toggle.disabled = true;
      }
    });
    
  } catch (err) {
    // If any error occurs, disable the toggle
    toggle.disabled = true;
  }
});
