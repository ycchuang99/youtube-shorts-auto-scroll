// Global enabled state
let isEnabled = true;

function scrollToNextVideo() {
  if (!isEnabled) return;

  // Find the next video button
  const nextButton = document.querySelector('#navigation-button-down button') ||
    document.querySelector('button[aria-label="Next video"]') ||
    document.querySelector('button[aria-label="下一部影片"]');

  if (nextButton) {
    nextButton.click();
  } else {
    // Fallback to manual scroll if button not found
    const reelsContainer = document.querySelector('ytd-reel-video-renderer[is-active]');
    if (reelsContainer) {
      const nextReel = reelsContainer.nextElementSibling;
      if (nextReel && nextReel.tagName.toLowerCase() === 'ytd-reel-video-renderer') {
        nextReel.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }
}

// Function to check if a video element is playing
function isVideoPlaying(video) {
  return !!(video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2);
}

// Main function to handle video end detection
function handleVideoEnd() {
  if (!isEnabled) return;

  // Find the active video in the shorts player
  const activeVideo = document.querySelector('ytd-reel-video-renderer[is-active] video');
  if (activeVideo) {
    // Remove existing event listeners
    activeVideo.removeEventListener('ended', scrollToNextVideo);
    activeVideo.removeEventListener('timeupdate', checkVideoProgress);

    // Add event listeners
    activeVideo.addEventListener('ended', scrollToNextVideo);
    activeVideo.addEventListener('timeupdate', checkVideoProgress);
  }
}

// Function to check video progress
function checkVideoProgress(event) {
  if (!isEnabled) return;

  const video = event.target;
  if (video.currentTime >= video.duration - 0.5) {
    scrollToNextVideo();
  }
}

// Create a function to check for active video changes
function checkForActiveVideoChanges() {
  if (!isEnabled) return;

  const prevActive = document.querySelector('ytd-reel-video-renderer[is-active]');

  const observer = new MutationObserver((mutations) => {
    if (!isEnabled) return;

    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'is-active') {
        handleVideoEnd();
      }
    });
  });

  // Observe changes to is-active attribute
  document.querySelectorAll('ytd-reel-video-renderer').forEach(reel => {
    observer.observe(reel, {
      attributes: true,
      attributeFilter: ['is-active']
    });
  });
}

// Observer for new videos being added
const pageObserver = new MutationObserver((mutations) => {
  if (!isEnabled) return;

  mutations.forEach((mutation) => {
    if (mutation.addedNodes.length) {
      const newReels = Array.from(mutation.addedNodes).filter(node =>
        node.nodeName === 'YTD-REEL-VIDEO-RENDERER'
      );

      if (newReels.length > 0) {
        handleVideoEnd();
        checkForActiveVideoChanges();
      }
    }
  });
});

// Start observing the document
pageObserver.observe(document.body, {
  childList: true,
  subtree: true
});

// Load initial state
chrome.storage.sync.get(['enabled'], function (result) {
  isEnabled = result.enabled !== false; // Default to true if not set
  if (isEnabled) {
    handleVideoEnd();
    checkForActiveVideoChanges();
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "toggleAutoScroll") {
    isEnabled = message.enabled;
    if (isEnabled) {
      handleVideoEnd();
      checkForActiveVideoChanges();
    }
  }
});

// Re-attach listeners when page visibility changes
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && isEnabled) {
    handleVideoEnd();
    checkForActiveVideoChanges();
  }
});
