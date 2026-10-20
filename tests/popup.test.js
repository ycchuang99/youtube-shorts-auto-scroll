/**
 * @jest-environment jsdom
 */

const fs = require('fs')
const path = require('path')
const englishMessages = require('../_locales/en/messages.json')
const popupHtml = fs.readFileSync(path.join(__dirname, '../src/popup/popup.html'), 'utf8')
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

function renderPopupDom() {
  document.documentElement.innerHTML = popupHtml
}

function setLocale(locale) {
  const messages = require(`../_locales/${locale}/messages.json`)
  chrome.i18n = {
    getMessage: jest.fn((key, substitution) => {
      if (key === '@@ui_locale') return locale
      return (messages[key] || englishMessages[key])?.message.replace('$speed$', substitution) || ''
    })
  }
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
    setLocale('en')
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
      expect(cardTitles).toEqual(['Auto Scroll', 'Skip Shorts ads', 'Playback Speed'])
      for (const control of document.querySelectorAll('input')) {
        expect(document.getElementById(control.getAttribute('aria-labelledby')).textContent).toBeTruthy()
      }
      expect(document.querySelector('.scope-note').textContent).toContain('Regular videos and their ads are unaffected')
    })
  })

  describe('Popup Script Integration', () => {
    test.each(['en', 'zh_TW', 'zh_CN'])('should localize visible and accessible content in %s', async (locale) => {
      setLocale(locale)
      const messages = require(`../_locales/${locale}/messages.json`)
      await loadPopupScript({ playbackSpeed: 1.5 })

      expect(document.documentElement.lang).toBe(locale.replace('_', '-'))
      expect(document.title).toBe(messages.extensionName.message)
      for (const element of document.querySelectorAll('[data-i18n]')) {
        expect(element.textContent).toBe(messages[element.dataset.i18n].message)
      }
      const speedText = messages.speedValue.message.replace('$speed$', '1.5')
      expect(document.getElementById('playbackSpeedValue').textContent).toBe(speedText)
      expect(document.getElementById('playbackSpeedSlider').getAttribute('aria-valuetext')).toBe(speedText)
      expect(Array.from(document.querySelectorAll('[data-speed]'), node => node.textContent)).toEqual(
        ['0.5', '1', '2'].map(speed => messages.speedValue.message.replace('$speed$', speed))
      )

      const toggle = document.getElementById('adSkipToggle')
      toggle.checked = false
      toggle.dispatchEvent(new Event('change'))
      await flushPromises()
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({ adSkipEnabled: false })
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, { action: 'toggleAdSkip', enabled: false })
    })

    test('should preserve readable English when a translation is unavailable', async () => {
      chrome.i18n.getMessage.mockReturnValue('')
      await loadPopupScript({ playbackSpeed: 0.75 })

      expect(document.documentElement.lang).toBe('en')
      expect(document.title).toBe('YouTube Shorts Auto Scroll')
      expect(document.getElementById('adSkipLabel').textContent).toBe('Skip Shorts ads')
      expect(document.getElementById('playbackSpeedValue').textContent).toBe('0.75x')
    })

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

    test('should keep settings when there is no active tab', async () => {
      chrome.tabs.query.mockResolvedValueOnce([])
      await loadPopupScript()

      const toggle = document.getElementById('toggleButton')
      toggle.checked = false
      toggle.dispatchEvent(new Event('change'))
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

  test('should provide complete locales for popup and manifest with English fallback', () => {
    const manifest = require('../manifest.json')
    expect(manifest.default_locale).toBe('en')
    expect(manifest.name).toBe('__MSG_extensionName__')
    expect(manifest.description).toBe('__MSG_extensionDescription__')
    expect(manifest.action.default_title).toBe('__MSG_extensionName__')
    for (const locale of ['en', 'zh_TW', 'zh_CN']) {
      const messages = require(`../_locales/${locale}/messages.json`)
      expect(Object.keys(messages).sort()).toEqual(Object.keys(englishMessages).sort())
      expect(messages.extensionDescription.message.length).toBeLessThanOrEqual(132)
      for (const element of document.querySelectorAll('[data-i18n]')) {
        expect(messages[element.dataset.i18n].message).toBeTruthy()
      }
      expect(messages.speedValue.placeholders.speed.content).toBe('$1')
    }
  })
})
