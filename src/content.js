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

// Function to check if we are on a shorts page
function isShortsPage() {
  return window.location.pathname.includes('/shorts/');
}

// Function to handle video end detection
function handleVideoEnd() {
  if (!isEnabled || !isShortsPage()) return;

  // Find the active video in the shorts player
  const activeVideo = document.querySelector('ytd-reel-video-renderer[is-active] video');
  if (activeVideo) {
    // Remove existing event listeners to prevent duplicates
    activeVideo.removeEventListener('ended', scrollToNextVideo);
    activeVideo.removeEventListener('timeupdate', checkVideoProgress);

    // Add event listeners
    activeVideo.addEventListener('ended', scrollToNextVideo);
    activeVideo.addEventListener('timeupdate', checkVideoProgress);
  }
}

// Function to check video progress
function checkVideoProgress(event) {
  if (!isEnabled || !isShortsPage()) return;

  const video = event.target;
  if (video.currentTime >= video.duration - 0.5) {
    scrollToNextVideo();
  }
}

let reelObserver = null;

// Create a function to check for active video changes
function checkForActiveVideoChanges() {
  if (!isEnabled || !isShortsPage()) return;

  if (reelObserver) {
    reelObserver.disconnect();
  }

  reelObserver = new MutationObserver((mutations) => {
    if (!isEnabled) return;

    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'is-active') {
        handleVideoEnd();
      }
    });
  });

  // Observe changes to is-active attribute
  document.querySelectorAll('ytd-reel-video-renderer').forEach(reel => {
    reelObserver.observe(reel, {
      attributes: true,
      attributeFilter: ['is-active']
    });
  });
}

// Global page observer to detect new videos or navigation
let pageObserver = null;

function setupPageObserver() {
  if (pageObserver) {
    pageObserver.disconnect();
  }

  pageObserver = new MutationObserver((mutations) => {
    if (!isEnabled || !isShortsPage()) return;

    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) {
        const hasNewReels = Array.from(mutation.addedNodes).some(node =>
          node.nodeName === 'YTD-REEL-VIDEO-RENDERER'
        );

        if (hasNewReels) {
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
}

function init() {
  if (isShortsPage()) {
    handleVideoEnd();
    checkForActiveVideoChanges();
    setupPageObserver();
  }
}

// Load initial state
chrome.storage.sync.get(['enabled'], function (result) {
  isEnabled = result.enabled !== false; // Default to true if not set
  init();
});

// Listen for YouTube's SPA navigation event
window.addEventListener('yt-navigate-finish', () => {
  init();
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "toggleAutoScroll") {
    isEnabled = message.enabled;
    if (isEnabled) {
      init();
    }
  }
});

// Re-attach listeners when page visibility changes
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && isEnabled) {
    init();
  }
});
