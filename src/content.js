(function (global) {
  let isEnabled = true;
  let autoSkipAds = true;
  let playbackSpeed = 1;
  let navigating = false;
  let pageObserver = null;
  let observedRoot = null;
  let scanInterval = null;
  let attachedVideo = null;
  let advancedSource = null;
  let lastSkippedAd = null;
  let adMedia = null;

  function isShortsPage() {
    return /^\/shorts(?:\/|$)/.test(window.location.pathname);
  }

  function canRun() {
    return isShortsPage() && !document.hidden && !navigating;
  }

  function isElementVisible(element) {
    if (!element || !element.isConnected || element.closest('[hidden], [aria-hidden="true"]')) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 &&
      rect.bottom > 0 && rect.right > 0 &&
      rect.top < window.innerHeight && rect.left < window.innerWidth &&
      style.display !== 'none' && style.visibility !== 'hidden';
  }

  function getActiveReel() {
    if (!canRun()) return null;
    let activeReel = null;
    let largestArea = 0;
    for (const reel of document.querySelectorAll('ytd-reel-video-renderer')) {
      if (!isElementVisible(reel)) continue;
      const rect = reel.getBoundingClientRect();
      const area = (Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)) *
        (Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
      if (area > largestArea || (area === largestArea && reel.hasAttribute('is-active'))) {
        activeReel = reel;
        largestArea = area;
      }
    }
    return activeReel;
  }

  function getActiveVideo() {
    const reel = getActiveReel();
    return reel ? Array.from(reel.querySelectorAll('video')).find(isElementVisible) || null : null;
  }

  function getFeedAd(reel) {
    return reel ? Array.from(reel.querySelectorAll('ytd-ad-slot-renderer, .ytd-ad-slot-renderer'))
      .find(isElementVisible) || null : null;
  }

  function isAdPlaying(reel = getActiveReel()) {
    return !!(reel && (getFeedAd(reel) || reel.querySelector('.ad-showing, .ad-interrupting')));
  }

  function scrollToNextVideo(reel = getActiveReel()) {
    if (!reel || reel !== getActiveReel()) return false;
    const controls = reel.closest('ytd-shorts') || reel;
    const nextButton = Array.from(controls.querySelectorAll(
      '#navigation-button-down button, button[aria-label="Next video"], button[aria-label="下一部影片"]'
    )).find(button => !button.disabled && isElementVisible(button));
    if (nextButton) {
      nextButton.click();
      return true;
    }
    const nextReel = reel.nextElementSibling;
    if (nextReel?.matches('ytd-reel-video-renderer')) {
      nextReel.scrollIntoView({ behavior: 'smooth' });
      return true;
    }
    return false;
  }

  function normalizePlaybackSpeed(value) {
    const speed = Number(value);
    return Number.isFinite(speed) && speed > 0 ? Math.min(2, Math.max(0.5, speed)) : 1;
  }

  function getVideoSource(video) {
    return video.currentSrc || video.src || window.location.pathname;
  }

  function isContentVideo(video) {
    if (!video || video !== getActiveVideo()) return false;
    const source = getVideoSource(video);
    if (isAdPlaying()) {
      adMedia = { video, source };
      return false;
    }
    // Ad UI may disappear before the ad's final media events arrive.
    if (!adMedia || adMedia.video !== video || adMedia.source !== source) return true;
    // Metadata for the next Short can arrive before the ad UI disappears.
    if (!video.paused && !video.ended && !video.seeking &&
        video.currentTime < video.duration - 0.5) {
      adMedia = null;
      return true;
    }
    return false;
  }

  function applyPlaybackSpeed(video = getActiveVideo()) {
    if (!isContentVideo(video)) return false;
    if (video.playbackRate !== playbackSpeed) video.playbackRate = playbackSpeed;
    return true;
  }

  function checkVideoProgress(event) {
    const video = event.target;
    if (!isEnabled || video !== attachedVideo || !isContentVideo(video)) return;
    if (video.seeking || !Number.isFinite(video.duration) || video.duration <= 0) return;
    if (!video.ended && (video.paused || video.currentTime < video.duration - 0.5)) return;
    const source = getVideoSource(video);
    if (advancedSource === source) return;
    advancedSource = source;
    if (!scrollToNextVideo()) advancedSource = null;
  }

  function onLoadedMetadata(event) {
    if (event.target === getActiveVideo() && !isAdPlaying()) adMedia = null;
    applyPlaybackSpeed(event.target);
  }

  function detachVideo() {
    if (attachedVideo) {
      attachedVideo.removeEventListener('ended', checkVideoProgress);
      attachedVideo.removeEventListener('timeupdate', checkVideoProgress);
      attachedVideo.removeEventListener('loadedmetadata', onLoadedMetadata);
    }
    attachedVideo = null;
    advancedSource = null;
  }

  function attachActiveVideo() {
    const video = getActiveVideo();
    if (video !== attachedVideo) {
      detachVideo();
      attachedVideo = video;
      if (video) {
        video.addEventListener('loadedmetadata', onLoadedMetadata);
        if (isEnabled) {
          video.addEventListener('ended', checkVideoProgress);
          video.addEventListener('timeupdate', checkVideoProgress);
        }
      }
    }
    applyPlaybackSpeed(video);
  }

  function handleAd() {
    if (!autoSkipAds || !canRun()) return;
    const reel = getActiveReel();
    const ad = getFeedAd(reel);
    if (!ad) {
      lastSkippedAd = null;
      return;
    }
    if (ad !== lastSkippedAd) {
      lastSkippedAd = ad;
      if (!scrollToNextVideo(reel)) lastSkippedAd = null;
    }
  }

  function stop() {
    clearInterval(scanInterval);
    scanInterval = null;
    if (pageObserver) pageObserver.disconnect();
    pageObserver = null;
    observedRoot = null;
    detachVideo();
    lastSkippedAd = null;
    adMedia = null;
  }

  function init() {
    if (!canRun()) {
      stop();
      return;
    }
    const root = document.querySelector('ytd-shorts') || document.body;
    if (root !== observedRoot) {
      if (pageObserver) pageObserver.disconnect();
      observedRoot = root;
      pageObserver = new MutationObserver(init);
      pageObserver.observe(root, {
        childList: true,
        subtree: true,
        ...(root === document.body ? {} : {
          attributes: true,
          attributeFilter: ['is-active', 'class', 'style', 'hidden', 'aria-hidden', 'src']
        })
      });
    }
    if (scanInterval === null) {
      // Scrolling can change the visible reel without changing its attributes.
      scanInterval = setInterval(init, 500);
    }
    attachActiveVideo();
    handleAd();
  }

  function setEnabled(value) {
    isEnabled = value === true;
    detachVideo();
    init();
  }

  function getEnabled() {
    return isEnabled;
  }

  function setPlaybackSpeed(value) {
    playbackSpeed = normalizePlaybackSpeed(value);
    applyPlaybackSpeed();
  }

  function getPlaybackSpeed() {
    return playbackSpeed;
  }

  if (typeof window !== 'undefined' && typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.sync.get(['enabled', 'adSkipEnabled', 'playbackSpeed'], result => {
      isEnabled = result.enabled !== false;
      autoSkipAds = result.adSkipEnabled !== false;
      playbackSpeed = normalizePlaybackSpeed(result.playbackSpeed ?? 1);
      init();
    });

    window.addEventListener('yt-navigate-start', () => {
      navigating = true;
      stop();
    });
    window.addEventListener('yt-navigate-finish', () => {
      navigating = false;
      init();
    });
    document.addEventListener('visibilitychange', init);

    chrome.runtime.onMessage.addListener(message => {
      if (message.action === 'toggleAutoScroll') setEnabled(message.enabled);
      if (message.action === 'toggleAdSkip') {
        autoSkipAds = message.enabled === true;
        init();
      }
      if (message.action === 'setPlaybackSpeed') setPlaybackSpeed(message.playbackSpeed);
    });
  }

  const api = {
    scrollToNextVideo,
    isShortsPage,
    setEnabled,
    getEnabled,
    setPlaybackSpeed,
    getPlaybackSpeed,
    applyPlaybackSpeed,
    isAdPlaying
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      ...api,
      getActiveReel,
      getActiveVideo,
      isElementVisible,
      checkVideoProgress,
      handleAd,
      init,
      stop
    };
  }
  if (typeof global !== 'undefined') global.YouTubeShortsAutoScroll = api;
})(typeof window !== 'undefined' ? window : global);
