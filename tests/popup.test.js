/**
 * @jest-environment jsdom
 */

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

function renderPopupDom() {
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
}

async function loadPopupScript(storageState = {}) {
  chrome.storage.sync.get.mockResolvedValueOnce({
    enabled: true,
    adSkipEnabled: true,
    playbackSpeed: 1,
    ...storageState
  })

  jest.resetModules()
  const addEventListenerSpy = jest.spyOn(document, 'addEventListener')
  require('../src/popup/popup.js')

  const domContentLoadedHandler = addEventListenerSpy.mock.calls.find(
    ([eventName]) => eventName === 'DOMContentLoaded'
  )?.[1]

  addEventListenerSpy.mockRestore()

  await domContentLoadedHandler()
  await flushPromises()
  await flushPromises()
}

describe('Popup UI', () => {
  beforeEach(() => {
    renderPopupDom()
    jest.clearAllMocks()
    chrome.tabs.query.mockResolvedValue([{ id: 1, url: 'https://youtube.com/shorts/test' }])
    chrome.tabs.sendMessage.mockResolvedValue()
  })

  describe('DOM Elements', () => {
    test('should render all interactive controls', () => {
      const toggle = document.getElementById('toggleButton')
      const adSkipToggle = document.getElementById('adSkipToggle')
      const speedSlider = document.getElementById('playbackSpeedSlider')
      const speedValue = document.getElementById('playbackSpeedValue')

      expect(toggle).not.toBeNull()
      expect(toggle.type).toBe('checkbox')
      expect(adSkipToggle).not.toBeNull()
      expect(adSkipToggle.type).toBe('checkbox')
      expect(speedSlider).not.toBeNull()
      expect(speedSlider.type).toBe('range')
      expect(speedSlider.min).toBe('0')
      expect(speedSlider.max).toBe('4')
      expect(speedSlider.step).toBe('1')
      expect(speedValue.textContent).toBe('1x')
    })

    test('should expose accessible labels and compact titles', () => {
      const cardTitles = Array.from(document.querySelectorAll('.card-title')).map(node => node.textContent)
      const speedSlider = document.getElementById('playbackSpeedSlider')

      expect(cardTitles).toEqual(['Auto Scroll', 'Skip Ads', 'Playback Speed'])
      expect(speedSlider.getAttribute('aria-label')).toBe('Playback speed')
      expect(document.querySelector('.card-subtitle')).toBeNull()
    })
  })

  describe('Popup Script Integration', () => {
    test('should hydrate controls from saved storage state', async () => {
      await loadPopupScript({
        enabled: false,
        adSkipEnabled: true,
        playbackSpeed: 1.5
      })

      expect(chrome.storage.sync.get).toHaveBeenCalledWith(['enabled', 'adSkipEnabled', 'playbackSpeed'])
      expect(document.getElementById('toggleButton').checked).toBe(false)
      expect(document.getElementById('adSkipToggle').checked).toBe(true)
      expect(document.getElementById('playbackSpeedSlider').value).toBe('3')
      expect(document.getElementById('playbackSpeedValue').textContent).toBe('1.5x')
    })

    test('should normalize invalid saved playback speed to the closest option', async () => {
      await loadPopupScript({ playbackSpeed: 1.6 })

      expect(document.getElementById('playbackSpeedSlider').value).toBe('3')
      expect(document.getElementById('playbackSpeedValue').textContent).toBe('1.5x')
    })

    test('should fall back to 1x when saved playback speed is not numeric', async () => {
      await loadPopupScript({ playbackSpeed: 'fast' })

      expect(document.getElementById('playbackSpeedSlider').value).toBe('2')
      expect(document.getElementById('playbackSpeedValue').textContent).toBe('1x')
    })

    test('should persist and message auto-scroll toggle changes', async () => {
      await loadPopupScript({ enabled: true })

      const toggle = document.getElementById('toggleButton')
      toggle.checked = false
      toggle.dispatchEvent(new Event('change'))
      await flushPromises()
      await flushPromises()

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({ enabled: false })
      expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true })
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        action: 'toggleAutoScroll',
        enabled: false
      })
    })

    test('should persist and message skip-ads toggle changes', async () => {
      await loadPopupScript({ adSkipEnabled: true })

      const adSkipToggle = document.getElementById('adSkipToggle')
      adSkipToggle.checked = false
      adSkipToggle.dispatchEvent(new Event('change'))
      await flushPromises()
      await flushPromises()

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({ adSkipEnabled: false })
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        action: 'toggleAdSkip',
        enabled: false
      })
    })

    test('should update playback speed label on input without persisting immediately', async () => {
      await loadPopupScript({ playbackSpeed: 1 })

      const speedSlider = document.getElementById('playbackSpeedSlider')
      speedSlider.value = '1'
      speedSlider.dispatchEvent(new Event('input'))

      expect(document.getElementById('playbackSpeedValue').textContent).toBe('0.75x')
      expect(chrome.storage.sync.set).not.toHaveBeenCalled()
      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled()
    })

    test('should persist and message playback speed changes on change', async () => {
      await loadPopupScript({ playbackSpeed: 1 })

      const speedSlider = document.getElementById('playbackSpeedSlider')
      speedSlider.value = '4'
      speedSlider.dispatchEvent(new Event('change'))
      await flushPromises()
      await flushPromises()

      expect(document.getElementById('playbackSpeedValue').textContent).toBe('2x')
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({ playbackSpeed: 2 })
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        action: 'setPlaybackSpeed',
        playbackSpeed: 2
      })
    })

    test('should normalize invalid slider values before persisting playback speed', async () => {
      await loadPopupScript({ playbackSpeed: 1 })

      const speedSlider = document.getElementById('playbackSpeedSlider')
      let sliderValue = 'invalid'
      Object.defineProperty(speedSlider, 'value', {
        configurable: true,
        get: () => sliderValue,
        set: (value) => {
          sliderValue = String(value)
        }
      })

      speedSlider.dispatchEvent(new Event('change'))
      await flushPromises()
      await flushPromises()

      expect(speedSlider.value).toBe('2')
      expect(document.getElementById('playbackSpeedValue').textContent).toBe('1x')
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({ playbackSpeed: 1 })
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        action: 'setPlaybackSpeed',
        playbackSpeed: 1
      })
    })

    test('should still persist auto-scroll changes when current tab query fails', async () => {
      chrome.tabs.query.mockRejectedValueOnce(new Error('No active tab'))
      await loadPopupScript({ enabled: true })

      const toggle = document.getElementById('toggleButton')
      toggle.checked = false
      toggle.dispatchEvent(new Event('change'))
      await flushPromises()
      await flushPromises()

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({ enabled: false })
      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled()
    })

    test('should still persist skip-ads changes when messaging fails', async () => {
      chrome.tabs.sendMessage.mockRejectedValueOnce(new Error('Content script unavailable'))
      await loadPopupScript({ adSkipEnabled: true })

      const adSkipToggle = document.getElementById('adSkipToggle')
      adSkipToggle.checked = false
      adSkipToggle.dispatchEvent(new Event('change'))
      await flushPromises()
      await flushPromises()

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({ adSkipEnabled: false })
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        action: 'toggleAdSkip',
        enabled: false
      })
    })
  })
})
