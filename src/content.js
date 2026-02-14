// Wrap in IIFE for testability
(function(global) {
  // Global enabled state
  let isEnabled = true;

  // Helper function to check if an element is visible in viewport
  function isElementVisible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return rect.height > 0 && rect.width > 0 && 
           getComputedStyle(element).visibility !== 'hidden';
  }

  // Helper function to find the currently active video
  function getActiveVideo() {
    // Try legacy is-active first for backward compatibility
    let video = document.querySelector('ytd-reel-video-renderer[is-active] video');
    if (video) return video;
    
    // Fallback: Find first visible video in viewport
    const renderers = document.querySelectorAll('ytd-reel-video-renderer');
    for (const renderer of renderers) {
      const video = renderer.querySelector('video');
      if (video && isElementVisible(video)) {
        return video;
      }
    }
    return null;
  }

  // Helper function to find the currently active reel renderer
  function getActiveReel() {
    // Try legacy is-active first for backward compatibility
    let reel = document.querySelector('ytd-reel-video-renderer[is-active]');
    if (reel) return reel;
    
    // Fallback: Find first visible reel in viewport
    const renderers = document.querySelectorAll('ytd-reel-video-renderer');
    for (const renderer of renderers) {
      if (isElementVisible(renderer)) {
        return renderer;
      }
    }
    return null;
  }

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
      const activeReel = getActiveReel();
      if (activeReel) {
        const nextReel = activeReel.nextElementSibling;
        if (nextReel && nextReel.tagName.toLowerCase() === 'ytd-reel-video-renderer') {
          nextReel.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  }

  function isVideoPlaying(video) {
    return !!(video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2);
  }

  function isShortsPage() {
    return window.location.pathname.includes('/shorts/');
  }

  function setEnabled(value) {
    isEnabled = value;
  }

  function getEnabled() {
    return isEnabled;
  }

  function handleVideoEnd() {
    if (!isEnabled || !isShortsPage()) return;

    const activeVideo = getActiveVideo();
    if (activeVideo) {
      activeVideo.removeEventListener('ended', scrollToNextVideo);
      activeVideo.removeEventListener('timeupdate', checkVideoProgress);

      activeVideo.addEventListener('ended', scrollToNextVideo);
      activeVideo.addEventListener('timeupdate', checkVideoProgress);
    }
  }

  function checkVideoProgress(event) {
    if (!isEnabled || !isShortsPage()) return;

    const video = event.target;
    if (video.currentTime >= video.duration - 0.5) {
      scrollToNextVideo();
    }
  }

  let reelObserver = null;

  function checkForActiveVideoChanges() {
    if (!isEnabled || !isShortsPage()) return;

    if (reelObserver) {
      reelObserver.disconnect();
    }

    reelObserver = new MutationObserver((mutations) => {
      if (!isEnabled) return;

      mutations.forEach((mutation) => {
        // Handle attribute changes (backward compatibility for is-active)
        if (mutation.type === 'attributes' && mutation.attributeName === 'is-active') {
          handleVideoEnd();
        }
        // Handle new video elements being added
        if (mutation.type === 'childList') {
          handleVideoEnd();
        }
      });
    });

    // Observe each reel for changes
    document.querySelectorAll('ytd-reel-video-renderer').forEach(reel => {
      reelObserver.observe(reel, {
        attributes: true,
        attributeFilter: ['is-active'],
        childList: true,
        subtree: true
      });
    });
  }

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

  // Export for testing (only in test environment)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      scrollToNextVideo,
      isVideoPlaying,
      isShortsPage,
      handleVideoEnd,
      checkVideoProgress,
      checkForActiveVideoChanges,
      setupPageObserver,
      init,
      setEnabled,
      getEnabled,
      getActiveVideo,
      getActiveReel,
      isElementVisible
    };
  }

  // Browser execution (only when not in test environment)
  if (typeof window !== 'undefined' && typeof chrome !== 'undefined' && chrome.storage) {
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
  }

  // Expose to global for browser
  if (typeof global !== 'undefined') {
    global.YouTubeShortsAutoScroll = {
      scrollToNextVideo,
      isVideoPlaying,
      isShortsPage,
      setEnabled,
      getEnabled
    };
  }
})(typeof window !== 'undefined' ? window : global);
