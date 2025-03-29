// Function to scroll to the next video
function scrollToNextVideo() {
  window.scrollBy({
    top: window.innerHeight,
    behavior: 'smooth'
  });
}

// Function to check if a video element is playing
function isVideoPlaying(video) {
  return !!(video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2);
}

// Main function to handle video end detection
function handleVideoEnd() {
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    // Remove existing event listeners to prevent duplicates
    video.removeEventListener('ended', scrollToNextVideo);
    // Add new event listener
    video.addEventListener('ended', scrollToNextVideo);
  });
}

// Observer to watch for new videos being added to the page
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.addedNodes.length) {
      handleVideoEnd();
    }
  });
});

// Start observing the document with the configured parameters
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Initial setup
handleVideoEnd();
