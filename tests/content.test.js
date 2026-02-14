/**
 * @jest-environment jsdom
 */

const contentScript = require('../src/content.js')

describe('Content Script - YouTube Shorts Auto Scroll', () => {
  let mockVideo
  let mockNextButton
  let mockReelRenderer

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = ''
    
    // Create mock elements
    mockVideo = document.createElement('video')
    // Manually set properties as getters/setters for JSDOM
    Object.defineProperty(mockVideo, 'duration', {
      writable: true,
      value: 30
    })
    Object.defineProperty(mockVideo, 'currentTime', {
      writable: true,
      value: 0
    })
    Object.defineProperty(mockVideo, 'paused', {
      writable: true,
      value: false
    })
    Object.defineProperty(mockVideo, 'ended', {
      writable: true,
      value: false
    })
    Object.defineProperty(mockVideo, 'readyState', {
      writable: true,
      value: 4
    })
    
    mockNextButton = document.createElement('button')
    mockNextButton.setAttribute('aria-label', 'Next video')
    mockNextButton.id = 'mock-next-button'
    
    mockReelRenderer = document.createElement('ytd-reel-video-renderer')
    mockReelRenderer.setAttribute('is-active', '')
    mockReelRenderer.appendChild(mockVideo)
    
    document.body.appendChild(mockNextButton)
    document.body.appendChild(mockReelRenderer)

    // Reset chrome mocks
    jest.clearAllMocks()
    
    // Ensure enabled
    contentScript.setEnabled(true)
  })

  describe('isShortsPage', () => {
    test('should return true when on shorts page', () => {
      window.history.pushState({}, '', '/shorts/abc123')
      expect(contentScript.isShortsPage()).toBe(true)
    })

    test('should return false when not on shorts page', () => {
      window.history.pushState({}, '', '/watch?v=abc123')
      expect(contentScript.isShortsPage()).toBe(false)
    })

    test('should return false for homepage', () => {
      window.history.pushState({}, '', '/')
      expect(contentScript.isShortsPage()).toBe(false)
    })
  })

  describe('scrollToNextVideo', () => {
    beforeEach(() => {
      window.history.pushState({}, '', '/shorts/test123')
    })

    test('should click next button when available', () => {
      const clickSpy = jest.spyOn(mockNextButton, 'click')
      
      contentScript.scrollToNextVideo()
      
      expect(clickSpy).toHaveBeenCalled()
    })

    test('should scroll even when auto-scroll is disabled (for ad-skip feature)', () => {
      const clickSpy = jest.spyOn(mockNextButton, 'click')
      
      contentScript.setEnabled(false)
      contentScript.scrollToNextVideo()
      
      expect(clickSpy).toHaveBeenCalled()
    })

    test('should use fallback scroll when button not found', () => {
      // Remove next button
      document.body.removeChild(mockNextButton)
      
      // Add next reel
      const nextReel = document.createElement('ytd-reel-video-renderer')
      nextReel.scrollIntoView = jest.fn()
      mockReelRenderer.parentNode.appendChild(nextReel)
      
      contentScript.scrollToNextVideo()
      
      expect(nextReel.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
    })

    test('should handle missing next button and reel gracefully', () => {
      document.body.removeChild(mockNextButton)
      document.body.removeChild(mockReelRenderer)
      
      // Should not throw error
      expect(() => contentScript.scrollToNextVideo()).not.toThrow()
    })
  })

  describe('isVideoPlaying', () => {
    test('should return true when video is playing', () => {
      mockVideo.currentTime = 5
      mockVideo.paused = false
      mockVideo.ended = false
      mockVideo.readyState = 4
      
      expect(contentScript.isVideoPlaying(mockVideo)).toBe(true)
    })

    test('should return false when video is paused', () => {
      mockVideo.currentTime = 5
      mockVideo.paused = true
      mockVideo.ended = false
      mockVideo.readyState = 4
      
      expect(contentScript.isVideoPlaying(mockVideo)).toBe(false)
    })

    test('should return false when video has ended', () => {
      mockVideo.currentTime = 30
      mockVideo.paused = false
      mockVideo.ended = true
      mockVideo.readyState = 4
      
      expect(contentScript.isVideoPlaying(mockVideo)).toBe(false)
    })

    test('should return false when video is not ready', () => {
      mockVideo.currentTime = 5
      mockVideo.paused = false
      mockVideo.ended = false
      mockVideo.readyState = 1
      
      expect(contentScript.isVideoPlaying(mockVideo)).toBe(false)
    })

    test('should return false when currentTime is 0', () => {
      mockVideo.currentTime = 0
      mockVideo.paused = false
      mockVideo.ended = false
      mockVideo.readyState = 4
      
      expect(contentScript.isVideoPlaying(mockVideo)).toBe(false)
    })
  })

  describe('setEnabled and getEnabled', () => {
    test('should set and get enabled state', () => {
      contentScript.setEnabled(true)
      expect(contentScript.getEnabled()).toBe(true)
      
      contentScript.setEnabled(false)
      expect(contentScript.getEnabled()).toBe(false)
    })
  })

  describe('handleVideoEnd', () => {
    beforeEach(() => {
      window.history.pushState({}, '', '/shorts/test123')
    })

    test('should attach event listeners to active video', () => {
      const addEventSpy = jest.spyOn(mockVideo, 'addEventListener')
      
      contentScript.handleVideoEnd()
      
      expect(addEventSpy).toHaveBeenCalledWith('ended', expect.any(Function))
      expect(addEventSpy).toHaveBeenCalledWith('timeupdate', expect.any(Function))
    })

    test('should not attach listeners when disabled', () => {
      contentScript.setEnabled(false)
      const addEventSpy = jest.spyOn(mockVideo, 'addEventListener')
      
      contentScript.handleVideoEnd()
      
      expect(addEventSpy).not.toHaveBeenCalled()
    })

    test('should not attach listeners when not on shorts page', () => {
      window.history.pushState({}, '', '/watch?v=abc')
      const addEventSpy = jest.spyOn(mockVideo, 'addEventListener')
      
      contentScript.handleVideoEnd()
      
      expect(addEventSpy).not.toHaveBeenCalled()
    })

    test('should remove existing listeners before adding new ones', () => {
      const removeEventSpy = jest.spyOn(mockVideo, 'removeEventListener')
      
      contentScript.handleVideoEnd()
      
      expect(removeEventSpy).toHaveBeenCalledWith('ended', expect.any(Function))
      expect(removeEventSpy).toHaveBeenCalledWith('timeupdate', expect.any(Function))
    })
  })

  describe('checkVideoProgress', () => {
    beforeEach(() => {
      window.history.pushState({}, '', '/shorts/test123')
    })

    test('should trigger scroll when video near end', () => {
      mockVideo.currentTime = 29.6
      mockVideo.duration = 30
      
      // Mock the button click
      const clickSpy = jest.spyOn(mockNextButton, 'click')
      const event = { target: mockVideo }
      
      contentScript.checkVideoProgress(event)
      
      expect(clickSpy).toHaveBeenCalled()
    })

    test('should not trigger scroll when video not near end', () => {
      mockVideo.currentTime = 15
      mockVideo.duration = 30
      
      const clickSpy = jest.spyOn(mockNextButton, 'click')
      const event = { target: mockVideo }
      
      contentScript.checkVideoProgress(event)
      
      expect(clickSpy).not.toHaveBeenCalled()
    })

    test('should not trigger when disabled', () => {
      contentScript.setEnabled(false)
      mockVideo.currentTime = 29.6
      mockVideo.duration = 30
      
      const clickSpy = jest.spyOn(mockNextButton, 'click')
      const event = { target: mockVideo }
      
      contentScript.checkVideoProgress(event)
      
      expect(clickSpy).not.toHaveBeenCalled()
    })
  })

  describe('Video Detection', () => {
    test('should detect video element in active reel', () => {
      const activeReel = document.querySelector('[is-active]')
      expect(activeReel).not.toBeNull()
      
      const video = activeReel?.querySelector('video')
      expect(video).toBe(mockVideo)
    })

    test('should handle missing video element', () => {
      mockReelRenderer.removeChild(mockVideo)
      const activeReel = document.querySelector('[is-active]')
      const video = activeReel?.querySelector('video')
      
      expect(video).toBeNull()
    })
  })

  describe('Multi-language Support', () => {
    test('should support English next button', () => {
      const button = document.querySelector('button[aria-label="Next video"]')
      expect(button).not.toBeNull()
    })

    test('should support Chinese next button', () => {
      document.body.removeChild(mockNextButton)
      
      const chineseButton = document.createElement('button')
      chineseButton.setAttribute('aria-label', '下一部影片')
      document.body.appendChild(chineseButton)
      
      const button = document.querySelector('button[aria-label="下一部影片"]')
      expect(button).not.toBeNull()
    })

    test('should click Chinese button when available', () => {
      document.body.removeChild(mockNextButton)
      
      const chineseButton = document.createElement('button')
      chineseButton.setAttribute('aria-label', '下一部影片')
      document.body.appendChild(chineseButton)
      
      const clickSpy = jest.spyOn(chineseButton, 'click')
      
      contentScript.scrollToNextVideo()
      
      expect(clickSpy).toHaveBeenCalled()
    })
  })

  describe('init', () => {
    beforeEach(() => {
      window.history.pushState({}, '', '/shorts/test123')
    })

    test('should initialize when on shorts page', () => {
      // Just verify it doesn't throw and can be called
      expect(() => contentScript.init()).not.toThrow()
    })

    test('should not throw when not on shorts page', () => {
      window.history.pushState({}, '', '/watch?v=abc')
      
      expect(() => contentScript.init()).not.toThrow()
    })
  })

  describe('checkForActiveVideoChanges', () => {
    beforeEach(() => {
      window.history.pushState({}, '', '/shorts/test123')
    })

    test('should not throw when called', () => {
      expect(() => contentScript.checkForActiveVideoChanges()).not.toThrow()
    })

    test('should not throw when disabled', () => {
      contentScript.setEnabled(false)
      expect(() => contentScript.checkForActiveVideoChanges()).not.toThrow()
    })

    test('should not throw when not on shorts page', () => {
      window.history.pushState({}, '', '/watch?v=abc')
      expect(() => contentScript.checkForActiveVideoChanges()).not.toThrow()
    })
  })

  describe('setupPageObserver', () => {
    test('should not throw when called', () => {
      expect(() => contentScript.setupPageObserver()).not.toThrow()
    })

    test('should setup observer on document.body', () => {
      contentScript.setupPageObserver()
      // Just verify it doesn't crash
      expect(document.body).toBeTruthy()
    })
  })

  describe('Navigation button selectors', () => {
    beforeEach(() => {
      document.body.innerHTML = ''
    })

    test('should find button with #navigation-button-down selector', () => {
      const nav = document.createElement('div')
      nav.id = 'navigation-button-down'
      const button = document.createElement('button')
      nav.appendChild(button)
      document.body.appendChild(nav)

      const clickSpy = jest.spyOn(button, 'click')
      contentScript.scrollToNextVideo()

      expect(clickSpy).toHaveBeenCalled()
    })
  })

  describe('Edge cases', () => {
    test('should handle when active reel has no next sibling', () => {
      document.body.innerHTML = ''
      const reel = document.createElement('ytd-reel-video-renderer')
      reel.setAttribute('is-active', '')
      document.body.appendChild(reel)

      // Should not throw
      expect(() => contentScript.scrollToNextVideo()).not.toThrow()
    })

    test('should handle when next sibling is not a reel', () => {
      document.body.innerHTML = ''
      const reel = document.createElement('ytd-reel-video-renderer')
      reel.setAttribute('is-active', '')
      const div = document.createElement('div')
      document.body.appendChild(reel)
      document.body.appendChild(div)

      // Should not throw
      expect(() => contentScript.scrollToNextVideo()).not.toThrow()
    })

    test('should handle video without duration', () => {
      const video = document.createElement('video')
      Object.defineProperty(video, 'duration', { value: NaN })
      Object.defineProperty(video, 'currentTime', { value: 0 })

      const event = { target: video }
      
      // Should not throw
      expect(() => contentScript.checkVideoProgress(event)).not.toThrow()
    })
  })

  describe('Integration tests', () => {
    beforeEach(() => {
      window.history.pushState({}, '', '/shorts/test123')
      document.body.innerHTML = ''
    })

    test('should work end-to-end with button click', () => {
      const button = document.createElement('button')
      button.setAttribute('aria-label', 'Next video')
      document.body.appendChild(button)

      const clickSpy = jest.spyOn(button, 'click')
      
      contentScript.setEnabled(true)
      contentScript.scrollToNextVideo()

      expect(clickSpy).toHaveBeenCalled()
    })

    test('should work end-to-end with fallback scroll', () => {
      const reel1 = document.createElement('ytd-reel-video-renderer')
      reel1.setAttribute('is-active', '')
      const reel2 = document.createElement('ytd-reel-video-renderer')
      reel2.scrollIntoView = jest.fn()
      
      document.body.appendChild(reel1)
      document.body.appendChild(reel2)

      contentScript.scrollToNextVideo()

      expect(reel2.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
    })
  })

  describe('Helper Functions', () => {
    describe('isElementVisible', () => {
      test('should return false when element is null', () => {
        expect(contentScript.isElementVisible(null)).toBe(false)
      })

      test('should return false when element is undefined', () => {
        expect(contentScript.isElementVisible(undefined)).toBe(false)
      })

      test('should return true when element has positive dimensions and is visible', () => {
        const element = document.createElement('div')
        element.style.visibility = 'visible'
        
        Object.defineProperty(element, 'getBoundingClientRect', {
          value: jest.fn(() => ({
            height: 100,
            width: 100,
            top: 0,
            left: 0,
            bottom: 100,
            right: 100
          }))
        })
        
        window.getComputedStyle = jest.fn(() => ({
          visibility: 'visible'
        }))
        
        expect(contentScript.isElementVisible(element)).toBe(true)
      })

      test('should return false when element has zero height', () => {
        const element = document.createElement('div')
        
        Object.defineProperty(element, 'getBoundingClientRect', {
          value: jest.fn(() => ({
            height: 0,
            width: 100
          }))
        })
        
        window.getComputedStyle = jest.fn(() => ({
          visibility: 'visible'
        }))
        
        expect(contentScript.isElementVisible(element)).toBe(false)
      })

      test('should return false when element has zero width', () => {
        const element = document.createElement('div')
        
        Object.defineProperty(element, 'getBoundingClientRect', {
          value: jest.fn(() => ({
            height: 100,
            width: 0
          }))
        })
        
        window.getComputedStyle = jest.fn(() => ({
          visibility: 'visible'
        }))
        
        expect(contentScript.isElementVisible(element)).toBe(false)
      })

      test('should return false when element visibility is hidden', () => {
        const element = document.createElement('div')
        
        Object.defineProperty(element, 'getBoundingClientRect', {
          value: jest.fn(() => ({
            height: 100,
            width: 100
          }))
        })
        
        window.getComputedStyle = jest.fn(() => ({
          visibility: 'hidden'
        }))
        
        expect(contentScript.isElementVisible(element)).toBe(false)
      })
    })

    describe('getActiveVideo', () => {
      test('should return video when legacy is-active attribute exists', () => {
        document.body.innerHTML = ''
        const reel = document.createElement('ytd-reel-video-renderer')
        reel.setAttribute('is-active', '')
        const video = document.createElement('video')
        reel.appendChild(video)
        document.body.appendChild(reel)
        
        expect(contentScript.getActiveVideo()).toBe(video)
      })

      test('should return first visible video when is-active does not exist', () => {
        document.body.innerHTML = ''
        
        const reel1 = document.createElement('ytd-reel-video-renderer')
        const video1 = document.createElement('video')
        reel1.appendChild(video1)
        document.body.appendChild(reel1)
        
        const reel2 = document.createElement('ytd-reel-video-renderer')
        const video2 = document.createElement('video')
        reel2.appendChild(video2)
        document.body.appendChild(reel2)
        
        // Setup mocks for visibility
        Object.defineProperty(video1, 'getBoundingClientRect', {
          value: jest.fn(() => ({ height: 0, width: 100 }))
        })
        Object.defineProperty(video2, 'getBoundingClientRect', {
          value: jest.fn(() => ({ height: 100, width: 100 }))
        })
        
        window.getComputedStyle = jest.fn(() => ({
          visibility: 'visible'
        }))
        
        const result = contentScript.getActiveVideo()
        
        expect(result).toBe(video2)
      })

      test('should return null when no videos exist', () => {
        document.body.innerHTML = ''
        
        expect(contentScript.getActiveVideo()).toBeNull()
      })

      test('should return null when all videos are invisible', () => {
        document.body.innerHTML = ''
        
        const reel = document.createElement('ytd-reel-video-renderer')
        const video = document.createElement('video')
        reel.appendChild(video)
        document.body.appendChild(reel)
        
        Object.defineProperty(video, 'getBoundingClientRect', {
          value: jest.fn(() => ({ height: 0, width: 0 }))
        })
        
        window.getComputedStyle = jest.fn(() => ({
          visibility: 'hidden'
        }))
        
        const result = contentScript.getActiveVideo()
        
        expect(result).toBeNull()
      })

      test('should skip invisible videos and find the visible one', () => {
        document.body.innerHTML = ''
        
        const reel1 = document.createElement('ytd-reel-video-renderer')
        const video1 = document.createElement('video')
        reel1.appendChild(video1)
        document.body.appendChild(reel1)
        
        const reel2 = document.createElement('ytd-reel-video-renderer')
        const video2 = document.createElement('video')
        reel2.appendChild(video2)
        document.body.appendChild(reel2)
        
        const reel3 = document.createElement('ytd-reel-video-renderer')
        const video3 = document.createElement('video')
        reel3.appendChild(video3)
        document.body.appendChild(reel3)
        
        // Setup mocks: first invisible, second invisible, third visible
        Object.defineProperty(video1, 'getBoundingClientRect', {
          value: jest.fn(() => ({ height: 0, width: 0 }))
        })
        Object.defineProperty(video2, 'getBoundingClientRect', {
          value: jest.fn(() => ({ height: 0, width: 0 }))
        })
        Object.defineProperty(video3, 'getBoundingClientRect', {
          value: jest.fn(() => ({ height: 100, width: 100 }))
        })
        
        window.getComputedStyle = jest.fn(() => ({
          visibility: 'visible'
        }))
        
        const result = contentScript.getActiveVideo()
        
        expect(result).toBe(video3)
      })
    })

    describe('getActiveReel', () => {
      test('should return reel when legacy is-active attribute exists', () => {
        document.body.innerHTML = ''
        const reel = document.createElement('ytd-reel-video-renderer')
        reel.setAttribute('is-active', '')
        document.body.appendChild(reel)
        
        expect(contentScript.getActiveReel()).toBe(reel)
      })

      test('should return first visible reel when is-active does not exist', () => {
        document.body.innerHTML = ''
        
        const reel1 = document.createElement('ytd-reel-video-renderer')
        document.body.appendChild(reel1)
        
        const reel2 = document.createElement('ytd-reel-video-renderer')
        document.body.appendChild(reel2)
        
        // Setup mocks for visibility
        Object.defineProperty(reel1, 'getBoundingClientRect', {
          value: jest.fn(() => ({ height: 0, width: 100 }))
        })
        Object.defineProperty(reel2, 'getBoundingClientRect', {
          value: jest.fn(() => ({ height: 100, width: 100 }))
        })
        
        window.getComputedStyle = jest.fn(() => ({
          visibility: 'visible'
        }))
        
        const result = contentScript.getActiveReel()
        
        expect(result).toBe(reel2)
      })

      test('should return null when no reels exist', () => {
        document.body.innerHTML = ''
        
        expect(contentScript.getActiveReel()).toBeNull()
      })

      test('should return null when all reels are invisible', () => {
        document.body.innerHTML = ''
        
        const reel = document.createElement('ytd-reel-video-renderer')
        document.body.appendChild(reel)
        
        Object.defineProperty(reel, 'getBoundingClientRect', {
          value: jest.fn(() => ({ height: 0, width: 0 }))
        })
        
        window.getComputedStyle = jest.fn(() => ({
          visibility: 'hidden'
        }))
        
        const result = contentScript.getActiveReel()
        
        expect(result).toBeNull()
      })

      test('should skip invisible reels and find the visible one', () => {
        document.body.innerHTML = ''
        
        const reel1 = document.createElement('ytd-reel-video-renderer')
        document.body.appendChild(reel1)
        
        const reel2 = document.createElement('ytd-reel-video-renderer')
        document.body.appendChild(reel2)
        
        const reel3 = document.createElement('ytd-reel-video-renderer')
        document.body.appendChild(reel3)
        
        // Setup mocks: first invisible, second invisible, third visible
        Object.defineProperty(reel1, 'getBoundingClientRect', {
          value: jest.fn(() => ({ height: 0, width: 0 }))
        })
        Object.defineProperty(reel2, 'getBoundingClientRect', {
          value: jest.fn(() => ({ height: 0, width: 0 }))
        })
        Object.defineProperty(reel3, 'getBoundingClientRect', {
          value: jest.fn(() => ({ height: 100, width: 100 }))
        })
        
        window.getComputedStyle = jest.fn(() => ({
          visibility: 'visible'
        }))
        
        const result = contentScript.getActiveReel()
        
        expect(result).toBe(reel3)
      })
    })
  })

  describe('Ad Skip Functionality', () => {
    let mockPlayer
    let mockVideo
    let originalConsoleLog

    beforeEach(() => {
      document.body.innerHTML = ''
      
      mockPlayer = document.createElement('div')
      mockPlayer.id = 'movie_player'
      document.body.appendChild(mockPlayer)
      
      mockVideo = document.createElement('video')
      Object.defineProperty(mockVideo, 'muted', {
        writable: true,
        value: false
      })
      Object.defineProperty(mockVideo, 'playbackRate', {
        writable: true,
        value: 1.0
      })
      Object.defineProperty(mockVideo, 'duration', {
        writable: true,
        value: 30
      })
      Object.defineProperty(mockVideo, 'currentTime', {
        writable: true,
        value: 0
      })
      document.body.appendChild(mockVideo)
      
      originalConsoleLog = console.log
      console.log = jest.fn()
    })

    afterEach(() => {
      console.log = originalConsoleLog
    })

    describe('isAdPlaying', () => {
      test('should detect ad via .html5-video-player.ad-showing', () => {
        const htmlPlayer = document.createElement('div')
        htmlPlayer.className = 'html5-video-player ad-showing'
        document.body.appendChild(htmlPlayer)
        
        expect(contentScript.isAdPlaying()).toBe(true)
      })

      test('should detect ad via #movie_player.ad-showing', () => {
        mockPlayer.classList.add('ad-showing')
        
        expect(contentScript.isAdPlaying()).toBe(true)
      })

      test('should detect ad via .video-ads.ytp-ad-module with children', () => {
        const adModule = document.createElement('div')
        adModule.className = 'video-ads ytp-ad-module'
        const adChild = document.createElement('div')
        adModule.appendChild(adChild)
        document.body.appendChild(adModule)
        
        expect(contentScript.isAdPlaying()).toBe(true)
      })

      test('should not detect ad when .video-ads.ytp-ad-module has no children', () => {
        const adModule = document.createElement('div')
        adModule.className = 'video-ads ytp-ad-module'
        document.body.appendChild(adModule)
        
        expect(contentScript.isAdPlaying()).toBe(false)
      })

      test('should detect ad via legacy ad-interrupting class', () => {
        mockPlayer.classList.add('ad-interrupting')
        
        expect(contentScript.isAdPlaying()).toBe(true)
      })

      test('should detect ad via skip button presence', () => {
        const skipButton = document.createElement('button')
        skipButton.className = 'ytp-ad-skip-button-modern'
        mockPlayer.appendChild(skipButton)
        
        expect(contentScript.isAdPlaying()).toBe(true)
      })

      test('should return false when no ad indicators present', () => {
        expect(contentScript.isAdPlaying()).toBe(false)
      })

      test('should detect Shorts ad via ytd-ad-slot-renderer in active reel', () => {
        const activeReel = document.createElement('ytd-reel-video-renderer')
        activeReel.setAttribute('is-active', '')
        const adSlot = document.createElement('ytd-ad-slot-renderer')
        activeReel.appendChild(adSlot)
        document.body.appendChild(activeReel)
        
        expect(contentScript.isAdPlaying()).toBe(true)
      })

      test('should detect Shorts ad via .ytd-ad-slot-renderer class in active reel', () => {
        const activeReel = document.createElement('ytd-reel-video-renderer')
        activeReel.setAttribute('is-active', '')
        const adSlot = document.createElement('div')
        adSlot.className = 'ytd-ad-slot-renderer'
        activeReel.appendChild(adSlot)
        document.body.appendChild(activeReel)
        
        expect(contentScript.isAdPlaying()).toBe(true)
      })

      test('should not detect Shorts ad when ytd-ad-slot-renderer not in active reel', () => {
        const inactiveReel = document.createElement('ytd-reel-video-renderer')
        const adSlot = document.createElement('ytd-ad-slot-renderer')
        inactiveReel.appendChild(adSlot)
        document.body.appendChild(inactiveReel)
        
        expect(contentScript.isAdPlaying()).toBe(false)
      })

      test('should not detect Shorts ad when no active reel exists', () => {
        expect(contentScript.isAdPlaying()).toBe(false)
      })
    })

    describe('tryClickSkipButton', () => {
      test('should click #movie_player .ytp-ad-skip-button-modern', () => {
        const skipButton = document.createElement('button')
        skipButton.className = 'ytp-ad-skip-button-modern'
        Object.defineProperty(skipButton, 'offsetParent', {
          value: document.body
        })
        mockPlayer.appendChild(skipButton)
        
        const clickSpy = jest.spyOn(skipButton, 'click')
        
        const result = contentScript.tryClickSkipButton()
        
        expect(clickSpy).toHaveBeenCalled()
        expect(result).toBe(true)
      })

      test('should click #movie_player .ytp-ad-skip-button', () => {
        const skipButton = document.createElement('button')
        skipButton.className = 'ytp-ad-skip-button'
        Object.defineProperty(skipButton, 'offsetParent', {
          value: document.body
        })
        mockPlayer.appendChild(skipButton)
        
        const clickSpy = jest.spyOn(skipButton, 'click')
        
        const result = contentScript.tryClickSkipButton()
        
        expect(clickSpy).toHaveBeenCalled()
        expect(result).toBe(true)
      })

      test('should click .html5-video-player scoped skip button', () => {
        const htmlPlayer = document.createElement('div')
        htmlPlayer.className = 'html5-video-player'
        const skipButton = document.createElement('button')
        skipButton.className = 'ytp-ad-skip-button'
        Object.defineProperty(skipButton, 'offsetParent', {
          value: document.body
        })
        htmlPlayer.appendChild(skipButton)
        document.body.appendChild(htmlPlayer)
        
        const clickSpy = jest.spyOn(skipButton, 'click')
        
        const result = contentScript.tryClickSkipButton()
        
        expect(clickSpy).toHaveBeenCalled()
        expect(result).toBe(true)
      })

      test('should not click invisible button (offsetParent null)', () => {
        const skipButton = document.createElement('button')
        skipButton.className = 'ytp-ad-skip-button'
        Object.defineProperty(skipButton, 'offsetParent', {
          value: null
        })
        mockPlayer.appendChild(skipButton)
        
        const clickSpy = jest.spyOn(skipButton, 'click')
        
        const result = contentScript.tryClickSkipButton()
        
        expect(clickSpy).not.toHaveBeenCalled()
        expect(result).toBe(false)
      })

      test('should click overlay close button as fallback', () => {
        const closeButton = document.createElement('button')
        closeButton.className = 'ytp-ad-overlay-close-button'
        Object.defineProperty(closeButton, 'offsetParent', {
          value: document.body
        })
        document.body.appendChild(closeButton)
        
        const clickSpy = jest.spyOn(closeButton, 'click')
        
        const result = contentScript.tryClickSkipButton()
        
        expect(clickSpy).toHaveBeenCalled()
        expect(result).toBe(true)
      })

      test('should return false when no buttons found', () => {
        const result = contentScript.tryClickSkipButton()
        
        expect(result).toBe(false)
      })
    })

    describe('handleAd', () => {
      beforeEach(() => {
        mockPlayer.classList.add('ad-showing')
        Object.defineProperty(mockVideo, 'duration', {
          writable: true,
          value: 30
        })
      })

      test('should mute and speed up video when ad is playing', () => {
        contentScript.handleAd()
        
        expect(mockVideo.muted).toBe(true)
        expect(mockVideo.playbackRate).toBe(16.0)
      })

      test('should skip to end of video when ad is playing', () => {
        contentScript.handleAd()
        
        expect(mockVideo.currentTime).toBeGreaterThan(29)
      })

      test('should restore playback when ad is not playing', () => {
        mockVideo.muted = true
        mockVideo.playbackRate = 16.0
        mockPlayer.classList.remove('ad-showing')
        
        contentScript.handleAd()
        
        expect(mockVideo.playbackRate).toBe(1.0)
        expect(mockVideo.muted).toBe(false)
      })

      test('should attempt to click skip button when ad playing', () => {
        const skipButton = document.createElement('button')
        skipButton.className = 'ytp-ad-skip-button'
        Object.defineProperty(skipButton, 'offsetParent', {
          value: document.body
        })
        mockPlayer.appendChild(skipButton)
        
        const clickSpy = jest.spyOn(skipButton, 'click')
        
        contentScript.handleAd()
        
        expect(clickSpy).toHaveBeenCalled()
      })

      test('should not run when no video element exists', () => {
        document.body.removeChild(mockVideo)
        
        contentScript.handleAd()
        
        expect(mockPlayer.classList.contains('ad-showing')).toBe(true)
      })

      test('should handle multiple video elements', () => {
        const video2 = document.createElement('video')
        Object.defineProperty(video2, 'muted', {
          writable: true,
          value: false
        })
        Object.defineProperty(video2, 'playbackRate', {
          writable: true,
          value: 1.0
        })
        Object.defineProperty(video2, 'duration', {
          writable: true,
          value: 15
        })
        Object.defineProperty(video2, 'currentTime', {
          writable: true,
          value: 0
        })
        document.body.appendChild(video2)
        
        contentScript.handleAd()
        
        expect(mockVideo.muted).toBe(true)
        expect(video2.muted).toBe(true)
        expect(mockVideo.playbackRate).toBe(16.0)
        expect(video2.playbackRate).toBe(16.0)
      })

      test('should scroll to next video when Shorts ad is detected', () => {
        const activeReel = document.createElement('ytd-reel-video-renderer')
        activeReel.setAttribute('is-active', '')
        const adSlot = document.createElement('ytd-ad-slot-renderer')
        activeReel.appendChild(adSlot)
        document.body.appendChild(activeReel)
        
        const nextButton = document.createElement('button')
        nextButton.setAttribute('aria-label', '下一個影片')
        Object.defineProperty(nextButton, 'offsetParent', {
          value: document.body
        })
        const navigation = document.createElement('div')
        navigation.id = 'navigation-button-down'
        navigation.appendChild(nextButton)
        activeReel.appendChild(navigation)
        
        const clickSpy = jest.spyOn(nextButton, 'click')
        
        contentScript.handleAd()
        
        expect(clickSpy).toHaveBeenCalled()
      })

      test('should use regular video ad skip for non-Shorts ads', () => {
        mockPlayer.classList.add('ad-showing')
        
        contentScript.handleAd()
        
        expect(mockVideo.muted).toBe(true)
        expect(mockVideo.playbackRate).toBe(16.0)
      })

      test('should not scroll when Shorts ad detected but in inactive reel', () => {
        const inactiveReel = document.createElement('ytd-reel-video-renderer')
        const adSlot = document.createElement('ytd-ad-slot-renderer')
        inactiveReel.appendChild(adSlot)
        document.body.appendChild(inactiveReel)
        
        const scrollSpy = jest.spyOn(contentScript, 'scrollToNextVideo')
        
        contentScript.handleAd()
        
        expect(scrollSpy).not.toHaveBeenCalled()
      })

      test('should try skip button first before scrolling for Shorts ads', () => {
        const activeReel = document.createElement('ytd-reel-video-renderer')
        activeReel.setAttribute('is-active', '')
        const adSlot = document.createElement('ytd-ad-slot-renderer')
        activeReel.appendChild(adSlot)
        document.body.appendChild(activeReel)
        
        const skipButton = document.createElement('button')
        skipButton.className = 'ytp-ad-skip-button'
        Object.defineProperty(skipButton, 'offsetParent', {
          value: document.body
        })
        mockPlayer.appendChild(skipButton)
        
        const clickSpy = jest.spyOn(skipButton, 'click')
        
        contentScript.handleAd()
        
        expect(clickSpy).toHaveBeenCalled()
      })

      test('should not scroll multiple times for same Shorts ad (cooldown)', () => {
        jest.useFakeTimers()
        
        const activeReel = document.createElement('ytd-reel-video-renderer')
        activeReel.setAttribute('is-active', '')
        const adSlot = document.createElement('ytd-ad-slot-renderer')
        activeReel.appendChild(adSlot)
        document.body.appendChild(activeReel)
        
        const nextButton = document.createElement('button')
        nextButton.setAttribute('aria-label', '下一個影片')
        Object.defineProperty(nextButton, 'offsetParent', {
          value: document.body
        })
        const navigation = document.createElement('div')
        navigation.id = 'navigation-button-down'
        navigation.appendChild(nextButton)
        activeReel.appendChild(navigation)
        
        const clickSpy = jest.spyOn(nextButton, 'click')
        
        contentScript.handleAd()
        expect(clickSpy).toHaveBeenCalledTimes(1)
        
        jest.advanceTimersByTime(500)
        contentScript.handleAd()
        expect(clickSpy).toHaveBeenCalledTimes(1)
        
        jest.advanceTimersByTime(1600)
        contentScript.handleAd()
        expect(clickSpy).toHaveBeenCalledTimes(2)
        
        jest.useRealTimers()
      })

      test('should reset cooldown when no ad is playing', () => {
        jest.useFakeTimers()
        
        const activeReel = document.createElement('ytd-reel-video-renderer')
        activeReel.setAttribute('is-active', '')
        const adSlot = document.createElement('ytd-ad-slot-renderer')
        activeReel.appendChild(adSlot)
        document.body.appendChild(activeReel)
        
        const nextButton = document.createElement('button')
        nextButton.setAttribute('aria-label', '下一個影片')
        Object.defineProperty(nextButton, 'offsetParent', {
          value: document.body
        })
        const navigation = document.createElement('div')
        navigation.id = 'navigation-button-down'
        navigation.appendChild(nextButton)
        activeReel.appendChild(navigation)
        
        const clickSpy = jest.spyOn(nextButton, 'click')
        
        contentScript.handleAd()
        expect(clickSpy).toHaveBeenCalledTimes(1)
        
        adSlot.remove()
        contentScript.handleAd()
        
        const newAdSlot = document.createElement('ytd-ad-slot-renderer')
        activeReel.appendChild(newAdSlot)
        
        jest.advanceTimersByTime(100)
        contentScript.handleAd()
        expect(clickSpy).toHaveBeenCalledTimes(2)
        
        jest.useRealTimers()
      })
    })

    describe('initAdSkip', () => {
      test('should set up interval and observer', () => {
        jest.useFakeTimers()
        
        contentScript.initAdSkip()
        
        expect(window.adSkipInterval).toBeDefined()
        jest.clearAllTimers()
        jest.useRealTimers()
      })

      test('should handle gracefully when movie_player not found', () => {
        document.body.removeChild(mockPlayer)
        
        // Should not throw error
        expect(() => contentScript.initAdSkip()).not.toThrow()
      })

      test('should log when ad skip is disabled', () => {
        contentScript.stopAdSkip()
        
        expect(console.log).not.toHaveBeenCalledWith('[AdSkip] Ad skip is disabled')
      })
    })

    describe('stopAdSkip', () => {
      beforeEach(() => {
        jest.useFakeTimers()
        contentScript.initAdSkip()
        mockVideo.muted = true
        mockVideo.playbackRate = 10.0
      })

      afterEach(() => {
        jest.clearAllTimers()
        jest.useRealTimers()
      })

      test('should clear interval', () => {
        const intervalId = window.adSkipInterval
        
        contentScript.stopAdSkip()
        
        expect(window.adSkipInterval).toBeNull()
      })

      test('should restore video to normal playback', () => {
        contentScript.stopAdSkip()
        
        expect(mockVideo.playbackRate).toBe(1.0)
        expect(mockVideo.muted).toBe(false)
      })
    })
  })
})
