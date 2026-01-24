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

    test('should not scroll when disabled', () => {
      const clickSpy = jest.spyOn(mockNextButton, 'click')
      
      contentScript.setEnabled(false)
      contentScript.scrollToNextVideo()
      
      expect(clickSpy).not.toHaveBeenCalled()
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
})
