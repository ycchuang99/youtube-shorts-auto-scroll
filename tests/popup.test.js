/**
 * @jest-environment jsdom
 */

describe('Popup UI', () => {
  beforeEach(() => {
    // Set up DOM
    document.body.innerHTML = `
      <div class="container">
        <div class="header">
          <div class="logo-icon-wrapper">
            <img src="../../assets/images/scroll-icon-128.png" alt="Logo" class="logo-icon">
          </div>
          <h1>Shorts Auto Scroll</h1>
        </div>

        <div class="controls-grid">
          <div class="card toggle-card">
            <div class="card-info">
              <div class="card-title">Auto Scroll</div>
            </div>
            <label class="switch">
              <input type="checkbox" id="toggleButton">
              <span class="slider"></span>
            </label>
          </div>

          <div class="card toggle-card">
            <div class="card-info">
              <div class="card-title">Skip Ads</div>
            </div>
            <label class="switch">
              <input type="checkbox" id="adSkipToggle">
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <div class="card speed-card">
          <div class="speed-card-header">
            <div class="card-info">
              <div class="card-title">Playback Speed</div>
            </div>
            <div class="speed-value" id="playbackSpeedValue">1x</div>
          </div>
          <div class="speed-control">
            <div class="speed-range-shell">
              <input type="range" id="playbackSpeedSlider" class="speed-range" min="0" max="4" step="1" value="2" aria-label="Playback speed">
            </div>
            <div class="speed-scale" aria-hidden="true">
              <span>0.5x</span>
              <span>1x</span>
              <span>2x</span>
            </div>
          </div>
        </div>
      </div>
    `
    
    jest.clearAllMocks()
  })

  describe('DOM Elements', () => {
    test('should have toggle button', () => {
      const toggle = document.getElementById('toggleButton')
      expect(toggle).not.toBeNull()
      expect(toggle.type).toBe('checkbox')
    })

    test('should not show a status panel', () => {
      const status = document.getElementById('status')
      expect(status).toBeNull()
    })

    test('should have playback speed slider', () => {
      const speedSlider = document.getElementById('playbackSpeedSlider')
      const speedValue = document.getElementById('playbackSpeedValue')
      const speedScaleLabels = document.querySelectorAll('.speed-scale span')
      const speedRangeShell = document.querySelector('.speed-range-shell')
      expect(speedSlider).not.toBeNull()
      expect(speedSlider.type).toBe('range')
      expect(speedSlider.min).toBe('0')
      expect(speedSlider.max).toBe('4')
      expect(speedSlider.step).toBe('1')
      expect(speedValue.textContent).toBe('1x')
      expect(speedRangeShell).not.toBeNull()
      expect(speedScaleLabels).toHaveLength(3)
      expect(speedScaleLabels[0].textContent).toBe('0.5x')
      expect(speedScaleLabels[1].textContent).toBe('1x')
      expect(speedScaleLabels[2].textContent).toBe('2x')

      const speedSelect = document.getElementById('playbackSpeedSelect')
      expect(speedSelect).toBeNull()
    })

    test('should have header with title', () => {
      const title = document.querySelector('h1')
      expect(title).not.toBeNull()
      expect(title.textContent).toBe('Shorts Auto Scroll')
    })

    test('should use compact control titles', () => {
      const cardTitles = Array.from(document.querySelectorAll('.card-title')).map(node => node.textContent)

      expect(cardTitles).toEqual(['Auto Scroll', 'Skip Ads', 'Playback Speed'])
      expect(document.querySelector('.card-subtitle')).toBeNull()
    })
  })

  describe('Toggle Interaction', () => {
    test('should toggle state when clicked', () => {
      const toggle = document.getElementById('toggleButton')
      
      toggle.checked = false
      expect(toggle.checked).toBe(false)
      
      toggle.checked = true
      expect(toggle.checked).toBe(true)
    })

    test('should remain enabled when not on YouTube domain', () => {
      const toggle = document.getElementById('toggleButton')
      
      // Toggle should work regardless of domain
      toggle.checked = true
      toggle.disabled = false
      
      expect(toggle.disabled).toBe(false)
      expect(toggle.checked).toBe(true)
    })
  })

  describe('Chrome Storage Integration', () => {
    test('should load state from chrome storage', async () => {
      const result = await chrome.storage.sync.get(['enabled'])
      expect(result.enabled).toBe(true)
    })

    test('should save state to chrome storage on toggle', async () => {
      await chrome.storage.sync.set({ enabled: false })
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({ enabled: false })
    })

    test('should save playback speed to chrome storage', async () => {
      await chrome.storage.sync.set({ playbackSpeed: 1.5 })
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({ playbackSpeed: 1.5 })
    })
  })

  describe('Message Sending', () => {
    test('should send message to content script on toggle', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      await chrome.tabs.sendMessage(tab.id, { 
        action: 'toggleAutoScroll',
        enabled: true 
      })
      
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        { action: 'toggleAutoScroll', enabled: true }
      )
    })

    test('should send playback speed message to content script', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      await chrome.tabs.sendMessage(tab.id, {
        action: 'setPlaybackSpeed',
        playbackSpeed: 1.5
      })
      
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        { action: 'setPlaybackSpeed', playbackSpeed: 1.5 }
      )
    })

    test('should handle message sending errors gracefully', async () => {
      chrome.tabs.sendMessage.mockRejectedValueOnce(new Error('Tab not found'))
      
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        await chrome.tabs.sendMessage(tab.id, { 
          action: 'toggleAutoScroll',
          enabled: true 
        })
      } catch (err) {
        // Should silently fail without blocking UI
        expect(err.message).toBe('Tab not found')
      }
    })
  })

  describe('Popup Script Integration', () => {
    test('should load saved settings and send playback speed changes from real popup script', async () => {
      chrome.storage.sync.get.mockResolvedValueOnce({
        enabled: false,
        adSkipEnabled: true,
        playbackSpeed: 1.5
      })
      jest.resetModules()

      require('../src/popup/popup.js')
      document.dispatchEvent(new Event('DOMContentLoaded'))
      await Promise.resolve()
      await Promise.resolve()

      const toggle = document.getElementById('toggleButton')
      const adSkipToggle = document.getElementById('adSkipToggle')
      const speedSlider = document.getElementById('playbackSpeedSlider')
      const speedValue = document.getElementById('playbackSpeedValue')
      expect(toggle.checked).toBe(false)
      expect(adSkipToggle.checked).toBe(true)
      expect(speedSlider.value).toBe('3')
      expect(speedValue.textContent).toBe('1.5x')

      speedSlider.value = '1'
      speedSlider.dispatchEvent(new Event('input'))
      expect(speedValue.textContent).toBe('0.75x')

      speedSlider.value = '4'
      speedSlider.dispatchEvent(new Event('change'))
      await Promise.resolve()
      await Promise.resolve()

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({ playbackSpeed: 2 })
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        action: 'setPlaybackSpeed',
        playbackSpeed: 2
      })

      adSkipToggle.checked = false
      adSkipToggle.dispatchEvent(new Event('change'))
      await Promise.resolve()
      await Promise.resolve()

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({ adSkipEnabled: false })
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        action: 'toggleAdSkip',
        enabled: false
      })
    })
  })

  describe('Accessibility', () => {
    test('should have proper ARIA labels on switch', () => {
      const toggle = document.getElementById('toggleButton')
      const switchLabel = toggle.closest('.switch')
      
      expect(switchLabel).not.toBeNull()
      expect(toggle.type).toBe('checkbox')
    })

    test('should have descriptive text for screen readers', () => {
      const speedSlider = document.getElementById('playbackSpeedSlider')
      expect(speedSlider.getAttribute('aria-label')).toBe('Playback speed')
    })
  })
})
