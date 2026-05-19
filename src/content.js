// Wrap in IIFE for testability
(function(global) {
  // Global enabled state
  let isEnabled = true;
  let autoSkipAds = true;
  let playbackSpeed = 1.0;
  let lastAdSkipTime = 0;
  let lastSkippedAdElement = null;

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
    const nextButton = document.querySelector('#navigation-button-down button') ||
      document.querySelector('button[aria-label="Next video"]') ||
      document.querySelector('button[aria-label="下一部影片"]');

    if (nextButton) {
      nextButton.click();
    } else {
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

  function normalizePlaybackSpeed(value) {
    const speed = Number(value);
    if (!Number.isFinite(speed) || speed <= 0) {
      return 1.0;
    }
    return speed;
  }

  function applyPlaybackSpeed(video) {
    if (!isShortsPage()) return false;
    if (isAdPlaying()) return false;

    const targetVideo = video || getActiveVideo();
    if (!targetVideo) return false;

    targetVideo.playbackRate = playbackSpeed;
    return true;
  }

  function setPlaybackSpeed(value) {
    playbackSpeed = normalizePlaybackSpeed(value);
    applyPlaybackSpeed();
  }

  function getPlaybackSpeed() {
    return playbackSpeed;
  }

  function getRestoredPlaybackSpeed() {
    return isShortsPage() ? playbackSpeed : 1.0;
  }

  function canRestoreAudio() {
    const activation =
      (typeof navigator !== 'undefined' && navigator.userActivation) ||
      (typeof document !== 'undefined' && document.userActivation) ||
      null;

    if (!activation) {
      return true;
    }

    return activation.hasBeenActive || activation.isActive;
  }

  function restoreVideoAfterAd(video, restoredPlaybackSpeed) {
    if (video.playbackRate !== restoredPlaybackSpeed) {
      video.playbackRate = restoredPlaybackSpeed;
    }

    if (video.muted && canRestoreAudio()) {
      video.muted = false;
    }
  }

  function handleVideoEnd() {
    if (!isEnabled || !isShortsPage()) return;

    const activeVideo = getActiveVideo();
    if (activeVideo) {
      applyPlaybackSpeed(activeVideo);
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
  const adSkipVideoListeners = new WeakMap();

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
      applyPlaybackSpeed();
      checkForActiveVideoChanges();
      setupPageObserver();
    }
  }

  // Ad skip functionality
  function isAdPlaying() {
    const activeReel = getActiveReel();
    if (activeReel) {
      const hasAdSlotRenderer = activeReel.querySelector('ytd-ad-slot-renderer') !== null;
      const hasAdSlotClass = activeReel.querySelector('.ytd-ad-slot-renderer') !== null;
      
      if (hasAdSlotRenderer || hasAdSlotClass) {
        return true;
      }
    }
    
    const htmlPlayer = document.querySelector('.html5-video-player.ad-showing');
    const moviePlayer = document.querySelector('#movie_player.ad-showing');
    
    const adModule = document.querySelector('.video-ads.ytp-ad-module');
    const hasActiveAd = adModule && adModule.children.length > 0;
    
    const player = document.getElementById('movie_player');
    const hasAdInterrupting = player?.classList.contains('ad-interrupting');
    const hasAdShowing = player?.classList.contains('ad-showing');
    
    const skipButton = document.querySelector('#movie_player .ytp-ad-skip-button, #movie_player .ytp-ad-skip-button-modern');
    
    const adText = document.querySelector('.ytp-ad-text');
    const adOverlay = document.querySelector('.ytp-ad-player-overlay');
    const adPreviewText = document.querySelector('.ytp-ad-preview-text');
    
    return !!(htmlPlayer || moviePlayer || hasActiveAd || hasAdInterrupting || hasAdShowing || skipButton || adText || adOverlay || adPreviewText);
  }

  function tryClickSkipButton() {
    const skipSelectors = [
      '#movie_player .ytp-ad-skip-button-modern',
      '#movie_player .ytp-ad-skip-button',
      '#movie_player .ytp-skip-ad-button',
      '.html5-video-player .ytp-ad-skip-button-modern',
      '.html5-video-player .ytp-ad-skip-button',
      '.html5-video-player .ytp-skip-ad-button',
      '.ytp-skip-ad button',
      '[id^="skip-ad"] button',
      '[id^="skip-button"]'
    ];
    
    for (const selector of skipSelectors) {
      const button = document.querySelector(selector);
      if (button && button.offsetParent !== null) {
        button.click();
        return true;
      }
    }
    
    const closeButton = document.querySelector('.ytp-ad-overlay-close-button');
    if (closeButton && closeButton.offsetParent !== null) {
      closeButton.click();
      return true;
    }
    
    return false;
  }

  function handleAd() {
    if (!autoSkipAds) return;
    
    const videos = document.querySelectorAll('video');
    if (!videos || videos.length === 0) {
      return;
    }
    
    const adActive = isAdPlaying();
    
    if (adActive) {
      // Check if this is a Shorts ad (entire feed item) or regular video ad
      const activeReel = getActiveReel();
      const adSlotElement = activeReel ? 
        (activeReel.querySelector('ytd-ad-slot-renderer') || 
         activeReel.querySelector('.ytd-ad-slot-renderer')) : null;
      const isShortsAd = !!adSlotElement;
      
      if (isShortsAd) {
        // Cooldown: prevent multiple scrolls for the same ad
        const now = Date.now();
        const cooldownPeriod = 2000;
        
        if (adSlotElement === lastSkippedAdElement && 
            (now - lastAdSkipTime) < cooldownPeriod) {
          return;
        }
        
        // Try to find and click skip button first (if YouTube provides one for this ad)
        const skipButtonClicked = tryClickSkipButton();
        
        if (skipButtonClicked) {
          lastAdSkipTime = now;
          lastSkippedAdElement = adSlotElement;
        } else {
          // No skip button available, scroll to next video
          scrollToNextVideo();
          lastAdSkipTime = now;
          lastSkippedAdElement = adSlotElement;
        }
      } else {
        // Regular video ads - speed up, mute, and try to skip
        videos.forEach((video, index) => {
          try {
            video.muted = true;
            video.playbackRate = 16.0;
            
            if (video.duration && !isNaN(video.duration) && video.duration > 0) {
              video.currentTime = video.duration - 0.1;
            }
          } catch (e) {
          }
        });
        
        tryClickSkipButton();
      }
    } else {
      // Reset tracking when no ad is playing
      lastSkippedAdElement = null;
      
      const restoredPlaybackSpeed = getRestoredPlaybackSpeed();
      videos.forEach((video, index) => {
        restoreVideoAfterAd(video, restoredPlaybackSpeed);
      });
    }
  }

  let adObserver = null;

  function getAdSkipTimeupdateHandler(video) {
    let handler = adSkipVideoListeners.get(video);
    if (!handler) {
      handler = () => {
        if (isAdPlaying() && autoSkipAds) {
          handleAd();
        }
      };
      adSkipVideoListeners.set(video, handler);
    }
    return handler;
  }

  function attachAdSkipVideoListeners() {
    const videoElements = document.querySelectorAll('video');
    videoElements.forEach(video => {
      const handler = getAdSkipTimeupdateHandler(video);
      video.removeEventListener('timeupdate', handler);
      video.addEventListener('timeupdate', handler);
    });
  }

  function detachAdSkipVideoListeners() {
    const videoElements = document.querySelectorAll('video');
    videoElements.forEach(video => {
      const handler = adSkipVideoListeners.get(video);
      if (handler) {
        video.removeEventListener('timeupdate', handler);
      }
    });
  }

  function initAdSkip() {
    if (!autoSkipAds) {
      return;
    }
    
    handleAd();
    
    if (window.adSkipInterval) {
      clearInterval(window.adSkipInterval);
    }
    window.adSkipInterval = setInterval(handleAd, 100);
    
    const player = document.getElementById('movie_player');
    if (player) {
      if (adObserver) {
        adObserver.disconnect();
      }
      
      adObserver = new MutationObserver(handleAd);
      adObserver.observe(player, {
        attributes: true,
        attributeFilter: ['class'],
        childList: true,
        subtree: true
      });
    }
    
    attachAdSkipVideoListeners();
  }

  function stopAdSkip() {
    if (window.adSkipInterval) {
      clearInterval(window.adSkipInterval);
      window.adSkipInterval = null;
    }
    
    if (adObserver) {
      adObserver.disconnect();
      adObserver = null;
    }

    detachAdSkipVideoListeners();
    
    const video = document.querySelector('video');
    if (video) {
      restoreVideoAfterAd(video, getRestoredPlaybackSpeed());
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
      setPlaybackSpeed,
      getPlaybackSpeed,
      getRestoredPlaybackSpeed,
      applyPlaybackSpeed,
      getActiveVideo,
      getActiveReel,
      isElementVisible,
      isAdPlaying,
      tryClickSkipButton,
      handleAd,
      initAdSkip,
      stopAdSkip,
      attachAdSkipVideoListeners,
      detachAdSkipVideoListeners
    };
  }

  // Browser execution (only when not in test environment)
  if (typeof window !== 'undefined' && typeof chrome !== 'undefined' && chrome.storage) {
    // Load initial state
    chrome.storage.sync.get(['enabled', 'adSkipEnabled', 'playbackSpeed'], function (result) {
      isEnabled = result.enabled !== false;
      autoSkipAds = result.adSkipEnabled !== false;
      playbackSpeed = normalizePlaybackSpeed(result.playbackSpeed ?? 1.0);
      init();
      initAdSkip();
    });

    // Listen for YouTube's SPA navigation event
    window.addEventListener('yt-navigate-finish', () => {
      init();
      initAdSkip();
    });

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "toggleAutoScroll") {
        isEnabled = message.enabled;
        if (isEnabled) {
          init();
        }
      }
      
      if (message.action === "toggleAdSkip") {
        autoSkipAds = message.enabled;
        if (autoSkipAds) {
          initAdSkip();
        } else {
          stopAdSkip();
        }
      }

      if (message.action === "setPlaybackSpeed") {
        setPlaybackSpeed(message.playbackSpeed);
      }
    });

    // Re-attach listeners when page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && isEnabled) {
        init();
        initAdSkip();
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
      getEnabled,
      setPlaybackSpeed,
      getPlaybackSpeed,
      applyPlaybackSpeed,
      isAdPlaying
    };
  }
})(typeof window !== 'undefined' ? window : global);
