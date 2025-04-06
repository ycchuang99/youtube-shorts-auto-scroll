// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.getElementById('toggleButton');
  const status = document.createElement('div');
  status.className = 'status';
  document.body.appendChild(status);
  
  try {
    // Get current tab to check if we're on YouTube Shorts
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if we're on YouTube and specifically in the Shorts section
    const isYouTube = tab?.url?.includes('youtube.com');
    const isYouTubeShorts = tab?.url?.includes('youtube.com/shorts');

    if (!isYouTube) {
      toggle.disabled = true;
      status.textContent = 'Please open YouTube first';
      status.style.color = 'red';
      return;
    }

    if (!isYouTubeShorts) {
      toggle.disabled = true;
      status.textContent = 'Please navigate to YouTube Shorts';
      status.style.color = 'red';
      return;
    }

    // Load saved state
    const { enabled = true } = await chrome.storage.sync.get('enabled');
    toggle.checked = enabled;
    status.textContent = enabled ? 'Auto-scroll is enabled' : 'Auto-scroll is disabled';
    status.style.color = enabled ? 'green' : 'gray';

    // Handle toggle changes
    toggle.addEventListener('change', async () => {
      const enabled = toggle.checked;
      
      // Save state
      await chrome.storage.sync.set({ enabled });
      status.textContent = enabled ? 'Auto-scroll is enabled' : 'Auto-scroll is disabled';
      status.style.color = enabled ? 'green' : 'gray';
      
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
        status.textContent = 'Error: Please refresh the page';
        status.style.color = 'red';
      }
    });
    
  } catch (err) {
    // If any error occurs, disable the toggle
    toggle.disabled = true;
    status.textContent = 'Error: Please refresh the page';
    status.style.color = 'red';
  }
});
