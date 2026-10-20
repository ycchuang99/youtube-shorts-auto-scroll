/** @jest-environment jsdom */

function visible(element, { top = 100, left = 100, width = 400, height = 600 } = {}) {
  element.getBoundingClientRect = jest.fn(() => ({
    top, left, width, height, bottom: top + height, right: left + width
  }))
  return element
}

function makeVideo() {
  const video = visible(document.createElement('video'))
  for (const [name, value] of Object.entries({ duration: 30, currentTime: 0, paused: false, ended: false, seeking: false })) {
    Object.defineProperty(video, name, { configurable: true, writable: true, value })
  }
  return video
}

function makeReel(container, options = {}) {
  const reel = visible(document.createElement('ytd-reel-video-renderer'), options)
  if (options.active !== false) reel.setAttribute('is-active', '')
  const player = document.createElement('div')
  player.className = 'html5-video-player'
  const video = makeVideo()
  player.appendChild(video)
  reel.appendChild(player)
  container.appendChild(reel)
  return { reel, video, player }
}

function addFeedAd(reel, classOnly = false) {
  const ad = visible(document.createElement(classOnly ? 'div' : 'ytd-ad-slot-renderer'))
  if (classOnly) ad.className = 'ytd-ad-slot-renderer'
  reel.appendChild(ad)
  return ad
}

function trackMediaWrites(video) {
  return ['muted', 'playbackRate', 'currentTime'].map(name => {
    let value = video[name]
    const write = jest.fn(next => { value = next })
    Object.defineProperty(video, name, { configurable: true, get: () => value, set: write })
    return write
  })
}

describe('Shorts-only content runtime', () => {
  let script
  let shorts
  let reel
  let video
  let player
  let nextButton
  let observers
  let originalObserver
  let windowEvents
  let documentEvents
  let settings

  function boot(overrides = {}) {
    Object.assign(settings, overrides)
    script = require('../src/content.js')
    return script
  }

  function send(message) {
    global.__chromeRuntimeMessageListener(message)
  }

  function nearEnd(target = video) {
    target.currentTime = target.duration - 0.2
    target.dispatchEvent(new Event('timeupdate'))
  }

  beforeEach(() => {
    jest.resetModules()
    jest.useFakeTimers()
    jest.clearAllMocks()
    document.body.innerHTML = ''
    window.history.replaceState({}, '', '/shorts/test')
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    settings = { enabled: true, adSkipEnabled: true, playbackSpeed: 1 }
    chrome.storage.sync.get.mockImplementation((keys, callback) => callback(settings))
    shorts = document.createElement('ytd-shorts')
    document.body.appendChild(shorts)
    ;({ reel, video, player } = makeReel(shorts))
    const navigation = document.createElement('div')
    navigation.id = 'navigation-button-down'
    nextButton = visible(document.createElement('button'), { width: 40, height: 40 })
    nextButton.click = jest.fn()
    navigation.appendChild(nextButton)
    shorts.appendChild(navigation)
    observers = []
    originalObserver = global.MutationObserver
    global.MutationObserver = jest.fn(function (callback) {
      this.callback = callback
      this.observe = jest.fn()
      this.disconnect = jest.fn()
      observers.push(this)
    })
    windowEvents = jest.spyOn(window, 'addEventListener')
    documentEvents = jest.spyOn(document, 'addEventListener')
  })

  afterEach(() => {
    script?.stop()
    for (const [event, listener] of windowEvents.mock.calls) {
      if (event.startsWith('yt-navigate-')) window.removeEventListener(event, listener)
    }
    for (const [event, listener] of documentEvents.mock.calls) {
      if (event === 'visibilitychange') document.removeEventListener(event, listener)
    }
    global.MutationObserver = originalObserver
    jest.restoreAllMocks()
    jest.useRealTimers()
    script = null
  })

  test.each(['/shorts', '/shorts/', '/shorts/abc'])('recognizes the Shorts route %s', route => {
    window.history.replaceState({}, '', route)
    expect(boot().isShortsPage()).toBe(true)
  })

  test.each(['/watch?v=abc', '/', '/feed/subscriptions', '/other/shorts/abc', '/shorts-other/abc'])(
    'does not start runtime work on %s', route => {
      window.history.replaceState({}, '', route)
      expect(boot().isShortsPage()).toBe(false)
      expect(observers).toHaveLength(0)
      expect(jest.getTimerCount()).toBe(0)
    }
  )

  test('loads saved preferences without rewriting them', () => {
    boot({ enabled: false, adSkipEnabled: false, playbackSpeed: 1.25 })
    expect(chrome.storage.sync.get).toHaveBeenCalledWith(
      ['enabled', 'adSkipEnabled', 'playbackSpeed'], expect.any(Function)
    )
    expect(script.getEnabled()).toBe(false)
    expect(script.getPlaybackSpeed()).toBe(1.25)
    expect(video.playbackRate).toBe(1.25)
    expect(chrome.storage.sync.set).not.toHaveBeenCalled()
    nearEnd()
    expect(nextButton.click).not.toHaveBeenCalled()
  })

  test('supplies defaults for a fresh installation', () => {
    settings = {}
    boot()
    expect(script.getEnabled()).toBe(true)
    expect(script.getPlaybackSpeed()).toBe(1)
    nearEnd()
    expect(nextButton.click).toHaveBeenCalledTimes(1)
  })

  test('applies speed only to the current visible Shorts video', () => {
    const inactive = makeReel(shorts, { top: 900, active: false })
    const watchVideo = makeVideo()
    document.body.appendChild(watchVideo)
    boot({ playbackSpeed: 1.5 })
    expect(video.playbackRate).toBe(1.5)
    expect(inactive.video.playbackRate).toBe(1)
    expect(watchVideo.playbackRate).toBe(1)
    expect(script.applyPlaybackSpeed(watchVideo)).toBe(false)
    expect(script.applyPlaybackSpeed(inactive.video)).toBe(false)
    expect(watchVideo.playbackRate).toBe(1)
  })

  test.each([
    ['fast', 1], [0, 1], [-1, 1], [Infinity, 1], [0.1, 0.5], [10, 2], ['1.75', 1.75]
  ])('validates incoming playback speed %s', (value, expected) => {
    boot()
    send({ action: 'setPlaybackSpeed', playbackSpeed: value })
    expect(script.getPlaybackSpeed()).toBe(expected)
    expect(video.playbackRate).toBe(expected)
  })

  test('does not rewrite an already correct playback rate on each scan', () => {
    boot({ playbackSpeed: 1.5 })
    const writes = trackMediaWrites(video)
    jest.advanceTimersByTime(2000)
    writes.forEach(write => expect(write).not.toHaveBeenCalled())
  })

  test('handles missing reels or videos while Shorts loads', () => {
    reel.remove()
    boot()
    expect(script.getActiveReel()).toBeNull()
    expect(script.getActiveVideo()).toBeNull()
    expect(script.scrollToNextVideo()).toBe(false)
    shorts.appendChild(reel)
    video.remove()
    observers[0].callback([])
    expect(script.getActiveVideo()).toBeNull()
    expect(script.applyPlaybackSpeed()).toBe(false)
  })

  test('uses the reel occupying most of the viewport instead of a stale active sliver', () => {
    visible(reel, { top: -500 })
    const current = makeReel(shorts, { top: 120, active: false })
    boot({ playbackSpeed: 1.5 })
    expect(script.getActiveReel()).toBe(current.reel)
    expect(script.getActiveVideo()).toBe(current.video)
    expect(video.playbackRate).toBe(1)
    expect(current.video.playbackRate).toBe(1.5)
  })

  test('uses is-active to choose between equally visible reels', () => {
    reel.removeAttribute('is-active')
    const current = makeReel(shorts)
    boot()
    expect(script.getActiveReel()).toBe(current.reel)
  })

  test('ignores hidden and preloaded videos inside the active reel', () => {
    video.hidden = true
    const current = makeVideo()
    player.appendChild(current)
    boot({ playbackSpeed: 2 })
    expect(script.getActiveVideo()).toBe(current)
    expect(video.playbackRate).toBe(1)
    expect(current.playbackRate).toBe(2)
  })

  test.each([
    ['hidden attribute', element => { element.hidden = true }],
    ['aria-hidden ancestor', element => { element.parentElement.setAttribute('aria-hidden', 'true') }],
    ['display none', element => { element.style.display = 'none' }],
    ['visibility hidden', element => { element.style.visibility = 'hidden' }],
    ['zero width', element => visible(element, { width: 0 })],
    ['zero height', element => visible(element, { height: 0 })],
    ['below viewport', element => visible(element, { top: 900 })],
    ['above viewport', element => visible(element, { top: -800 })],
    ['right of viewport', element => visible(element, { left: 2000 })],
    ['left of viewport', element => visible(element, { left: -800 })]
  ])('does not select a reel with %s', (reason, hide) => {
    hide(reel)
    boot({ playbackSpeed: 2 })
    expect(script.getActiveReel()).toBeNull()
    expect(video.playbackRate).toBe(1)
    expect(nextButton.click).not.toHaveBeenCalled()
  })

  test('rejects absent and detached elements', () => {
    boot()
    expect(script.isElementVisible(null)).toBe(false)
    expect(script.isElementVisible(visible(document.createElement('div')))).toBe(false)
  })

  test('advances once across repeated near-end, ended, observer and polling callbacks', () => {
    boot()
    nearEnd()
    video.ended = true
    video.dispatchEvent(new Event('ended'))
    video.dispatchEvent(new Event('timeupdate'))
    observers[0].callback([])
    jest.advanceTimersByTime(5000)
    video.dispatchEvent(new Event('ended'))
    expect(nextButton.click).toHaveBeenCalledTimes(1)
  })

  test('handles ended when the final timeupdate was not emitted', () => {
    boot()
    video.ended = true
    video.dispatchEvent(new Event('ended'))
    expect(nextButton.click).toHaveBeenCalledTimes(1)
  })

  test.each([
    ['mid-video', { currentTime: 10 }],
    ['paused', { currentTime: 29.8, paused: true }],
    ['seeking', { currentTime: 29.8, seeking: true }],
    ['unknown duration', { currentTime: 29.8, duration: NaN }],
    ['live duration', { currentTime: 29.8, duration: Infinity }],
    ['empty duration', { duration: 0 }]
  ])('does not advance for %s', (reason, properties) => {
    boot()
    Object.assign(video, properties)
    video.dispatchEvent(new Event('timeupdate'))
    expect(nextButton.click).not.toHaveBeenCalled()
  })

  test('detaches the previous video and rejects queued events when a different reel becomes visible', () => {
    boot({ playbackSpeed: 1.5 })
    const remove = jest.spyOn(video, 'removeEventListener')
    visible(reel, { top: -800 })
    const current = makeReel(shorts)
    observers[0].callback([])
    expect(remove).toHaveBeenCalledWith('ended', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('timeupdate', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('loadedmetadata', expect.any(Function))
    nearEnd()
    script.checkVideoProgress({ target: video })
    video.playbackRate = 1
    video.dispatchEvent(new Event('loadedmetadata'))
    expect(video.playbackRate).toBe(1)
    expect(nextButton.click).not.toHaveBeenCalled()
    expect(current.video.playbackRate).toBe(1.5)
    nearEnd(current.video)
    expect(nextButton.click).toHaveBeenCalledTimes(1)
  })

  test('observes newly inserted wrapper subtrees and reapplies speed after metadata loads', () => {
    boot({ playbackSpeed: 1.5 })
    reel.remove()
    const wrapper = document.createElement('div')
    shorts.appendChild(wrapper)
    const current = makeReel(wrapper)
    observers[0].callback([{ type: 'childList', addedNodes: [wrapper] }])
    expect(current.video.playbackRate).toBe(1.5)
    current.video.playbackRate = 1
    current.video.dispatchEvent(new Event('loadedmetadata'))
    expect(current.video.playbackRate).toBe(1.5)
    nearEnd(current.video)
    expect(nextButton.click).toHaveBeenCalledTimes(1)
  })

  test('allows the same video element to play a new source without disabling future advancement', () => {
    boot()
    video.src = 'https://example.test/first.mp4'
    nearEnd()
    video.src = 'https://example.test/second.mp4'
    nearEnd()
    expect(nextButton.click).toHaveBeenCalledTimes(2)
  })

  test('does not stack event handlers, observers or intervals on repeated initialization', () => {
    boot()
    script.init()
    script.init()
    expect(observers).toHaveLength(1)
    expect(jest.getTimerCount()).toBe(1)
    nearEnd()
    expect(nextButton.click).toHaveBeenCalledTimes(1)
  })

  test('disables and re-enables auto-scroll immediately through popup messages', () => {
    boot()
    send({ action: 'toggleAutoScroll', enabled: false })
    nearEnd()
    expect(script.getEnabled()).toBe(false)
    expect(nextButton.click).not.toHaveBeenCalled()
    send({ action: 'toggleAutoScroll', enabled: true })
    nearEnd()
    expect(script.getEnabled()).toBe(true)
    expect(nextButton.click).toHaveBeenCalledTimes(1)
  })

  test('keeps speed control working when both toggles are disabled', () => {
    boot({ enabled: false, adSkipEnabled: false })
    send({ action: 'setPlaybackSpeed', playbackSpeed: 2 })
    expect(video.playbackRate).toBe(2)
    nearEnd()
    expect(nextButton.click).not.toHaveBeenCalled()
    visible(reel, { top: -800 })
    const current = makeReel(shorts)
    jest.advanceTimersByTime(500)
    expect(current.video.playbackRate).toBe(2)
  })

  test.each([false, true])('skips only the active Shorts feed ad once (class marker: %s)', classOnly => {
    addFeedAd(reel, classOnly)
    const writes = trackMediaWrites(video)
    boot({ enabled: false, playbackSpeed: 2 })
    expect(script.isAdPlaying()).toBe(true)
    expect(nextButton.click).toHaveBeenCalledTimes(1)
    jest.advanceTimersByTime(5000)
    observers[0].callback([])
    expect(nextButton.click).toHaveBeenCalledTimes(1)
    writes.forEach(write => expect(write).not.toHaveBeenCalled())
  })

  test('allows feed-ad skipping even when an ad card has no video element', () => {
    video.remove()
    addFeedAd(reel)
    boot({ enabled: false })
    expect(nextButton.click).toHaveBeenCalledTimes(1)
  })

  test('never uses normal video-end events to advance a feed ad when ad skipping is off', () => {
    addFeedAd(reel)
    boot({ adSkipEnabled: false, playbackSpeed: 2 })
    nearEnd()
    video.ended = true
    video.dispatchEvent(new Event('ended'))
    expect(nextButton.click).not.toHaveBeenCalled()
    expect(video.playbackRate).toBe(1)
    send({ action: 'toggleAdSkip', enabled: true })
    expect(nextButton.click).toHaveBeenCalledTimes(1)
    send({ action: 'toggleAdSkip', enabled: false })
    jest.advanceTimersByTime(5000)
    expect(nextButton.click).toHaveBeenCalledTimes(1)
  })

  test.each(['ad-showing', 'ad-interrupting'])('leaves an in-player %s ad untouched', adClass => {
    player.classList.add(adClass)
    const skipButton = visible(document.createElement('button'))
    skipButton.className = 'ytp-ad-skip-button-modern'
    skipButton.click = jest.fn()
    player.appendChild(skipButton)
    const writes = trackMediaWrites(video)
    video.ended = true
    boot({ playbackSpeed: 2 })
    video.dispatchEvent(new Event('ended'))
    send({ action: 'setPlaybackSpeed', playbackSpeed: 1.5 })
    jest.advanceTimersByTime(2000)
    expect(script.isAdPlaying()).toBe(true)
    expect(nextButton.click).not.toHaveBeenCalled()
    expect(skipButton.click).not.toHaveBeenCalled()
    writes.forEach(write => expect(write).not.toHaveBeenCalled())
    player.classList.remove(adClass)
    observers[0].callback([])
    video.dispatchEvent(new Event('ended'))
    expect(nextButton.click).not.toHaveBeenCalled()
    writes.forEach(write => expect(write).not.toHaveBeenCalled())
    video.ended = false
    video.dispatchEvent(new Event('loadedmetadata'))
    expect(video.playbackRate).toBe(1.5)
  })

  test('resumes normal playback when the reused player switches away from the ad source', () => {
    video.src = 'https://example.test/ad.mp4'
    player.classList.add('ad-showing')
    boot({ playbackSpeed: 1.5 })
    player.classList.remove('ad-showing')
    video.src = 'https://example.test/short.mp4'
    observers[0].callback([])
    expect(video.playbackRate).toBe(1.5)
    nearEnd()
    expect(nextButton.click).toHaveBeenCalledTimes(1)
  })

  test('resumes when content metadata arrives before the ad class is removed', () => {
    video.src = 'https://example.test/ad.mp4'
    player.classList.add('ad-showing')
    boot({ playbackSpeed: 1.5 })
    video.src = 'https://example.test/short.mp4'
    video.dispatchEvent(new Event('loadedmetadata'))
    expect(video.playbackRate).toBe(1)
    player.classList.remove('ad-showing')
    observers[0].callback([])
    expect(script.isAdPlaying()).toBe(false)
    expect(video.playbackRate).toBe(1.5)
    nearEnd()
    expect(nextButton.click).toHaveBeenCalledTimes(1)
  })

  test('keeps the trailing-ad guard through a pause and releases it when content playback resumes', () => {
    player.classList.add('ad-showing')
    video.currentTime = 29.8
    boot({ playbackSpeed: 1.5 })
    player.classList.remove('ad-showing')
    observers[0].callback([])
    video.dispatchEvent(new Event('timeupdate'))
    expect(video.playbackRate).toBe(1)
    expect(nextButton.click).not.toHaveBeenCalled()
    video.paused = true
    video.currentTime = 0
    observers[0].callback([])
    expect(video.playbackRate).toBe(1)
    video.paused = false
    video.dispatchEvent(new Event('timeupdate'))
    jest.advanceTimersByTime(500)
    expect(video.playbackRate).toBe(1.5)
    nearEnd()
    expect(nextButton.click).toHaveBeenCalledTimes(1)
  })

  test('ignores hidden feed ad placeholders and ads in offscreen reels', () => {
    addFeedAd(reel).hidden = true
    const inactive = makeReel(shorts, { top: 900 })
    addFeedAd(inactive.reel)
    boot({ playbackSpeed: 1.5 })
    expect(script.isAdPlaying()).toBe(false)
    expect(nextButton.click).not.toHaveBeenCalled()
    expect(video.playbackRate).toBe(1.5)
  })

  test('ignores regular player ads elsewhere in the document', () => {
    const watchPlayer = document.createElement('div')
    watchPlayer.id = 'movie_player'
    watchPlayer.className = 'html5-video-player ad-showing'
    const watchVideo = makeVideo()
    watchPlayer.appendChild(watchVideo)
    document.body.appendChild(watchPlayer)
    const writes = trackMediaWrites(watchVideo)
    boot({ playbackSpeed: 1.5 })
    expect(script.isAdPlaying()).toBe(false)
    expect(video.playbackRate).toBe(1.5)
    nearEnd()
    expect(nextButton.click).toHaveBeenCalledTimes(1)
    writes.forEach(write => expect(write).not.toHaveBeenCalled())
  })

  test('resets feed-ad tracking when normal content becomes active', () => {
    const ad = addFeedAd(reel)
    boot()
    expect(nextButton.click).toHaveBeenCalledTimes(1)
    ad.remove()
    observers[0].callback([])
    reel.appendChild(ad)
    observers[0].callback([])
    expect(nextButton.click).toHaveBeenCalledTimes(2)
  })

  test('retries navigation when the next control becomes available after the ad loads', () => {
    nextButton.remove()
    addFeedAd(reel)
    boot()
    expect(script.scrollToNextVideo()).toBe(false)
    shorts.querySelector('#navigation-button-down').appendChild(nextButton)
    observers[0].callback([])
    expect(nextButton.click).toHaveBeenCalledTimes(1)
  })

  test('uses the next reel as a fallback without clicking hidden or disabled controls', () => {
    nextButton.disabled = true
    const hiddenButton = visible(document.createElement('button'))
    hiddenButton.setAttribute('aria-label', 'Next video')
    hiddenButton.hidden = true
    hiddenButton.click = jest.fn()
    shorts.appendChild(hiddenButton)
    const following = makeReel(shorts, { top: 900, active: false })
    reel.after(following.reel)
    following.reel.scrollIntoView = jest.fn()
    boot()
    nearEnd()
    expect(nextButton.click).not.toHaveBeenCalled()
    expect(hiddenButton.click).not.toHaveBeenCalled()
    expect(following.reel.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
  })

  test.each(['Next video', '下一部影片'])('supports the scoped %s navigation fallback', label => {
    shorts.querySelector('#navigation-button-down').removeAttribute('id')
    nextButton.setAttribute('aria-label', label)
    boot()
    nearEnd()
    expect(nextButton.click).toHaveBeenCalledTimes(1)
  })

  test('never clicks unrelated document buttons when no Shorts control exists', () => {
    nextButton.remove()
    const outsideButton = visible(document.createElement('button'))
    outsideButton.setAttribute('aria-label', 'Next video')
    outsideButton.click = jest.fn()
    document.body.appendChild(outsideButton)
    boot()
    nearEnd()
    expect(outsideButton.click).not.toHaveBeenCalled()
  })

  test('does not change any video or click any control on watch pages, even with saved ad skipping enabled', () => {
    addFeedAd(reel)
    player.classList.add('ad-showing')
    const watchVideo = makeVideo()
    watchVideo.playbackRate = 1.25
    watchVideo.muted = true
    document.body.appendChild(watchVideo)
    const writes = [...trackMediaWrites(video), ...trackMediaWrites(watchVideo)]
    window.history.replaceState({}, '', '/watch?v=long-video')
    boot({ playbackSpeed: 2 })
    send({ action: 'toggleAutoScroll', enabled: true })
    send({ action: 'toggleAdSkip', enabled: true })
    send({ action: 'setPlaybackSpeed', playbackSpeed: 1.5 })
    script.handleAd()
    script.applyPlaybackSpeed(watchVideo)
    script.scrollToNextVideo(reel)
    script.checkVideoProgress({ target: video })
    script.stop()
    expect(observers).toHaveLength(0)
    expect(jest.getTimerCount()).toBe(0)
    expect(nextButton.click).not.toHaveBeenCalled()
    writes.forEach(write => expect(write).not.toHaveBeenCalled())
  })

  test('cleans up on SPA navigation start, remains inactive on watch and resumes on Shorts reentry', () => {
    boot({ playbackSpeed: 1.5 })
    const observer = observers[0]
    const writes = trackMediaWrites(video)
    window.dispatchEvent(new Event('yt-navigate-start'))
    expect(observer.disconnect).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
    video.ended = true
    video.dispatchEvent(new Event('ended'))
    script.checkVideoProgress({ target: video })
    send({ action: 'setPlaybackSpeed', playbackSpeed: 2 })
    observer.callback([])
    window.history.replaceState({}, '', '/watch?v=long-video')
    window.dispatchEvent(new Event('yt-navigate-finish'))
    expect(jest.getTimerCount()).toBe(0)
    expect(nextButton.click).not.toHaveBeenCalled()
    writes.forEach(write => expect(write).not.toHaveBeenCalled())
    window.history.replaceState({}, '', '/shorts/new-video')
    window.dispatchEvent(new Event('yt-navigate-finish'))
    expect(jest.getTimerCount()).toBe(1)
    expect(observers).toHaveLength(2)
    expect(video.playbackRate).toBe(2)
    video.dispatchEvent(new Event('ended'))
    expect(nextButton.click).toHaveBeenCalledTimes(1)
  })

  test('guards queued callbacks immediately when the URL leaves Shorts before the navigation event', () => {
    boot()
    window.history.replaceState({}, '', '/watch?v=long-video')
    const writes = trackMediaWrites(video)
    video.ended = true
    video.dispatchEvent(new Event('ended'))
    script.checkVideoProgress({ target: video })
    video.dispatchEvent(new Event('loadedmetadata'))
    script.handleAd()
    observers[0].callback([])
    expect(jest.getTimerCount()).toBe(0)
    expect(nextButton.click).not.toHaveBeenCalled()
    writes.forEach(write => expect(write).not.toHaveBeenCalled())
  })

  test('stops while hidden and resumes ad skipping independently of auto-scroll when visible', () => {
    boot({ enabled: false })
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(jest.getTimerCount()).toBe(0)
    addFeedAd(reel)
    script.handleAd()
    script.init()
    expect(nextButton.click).not.toHaveBeenCalled()
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(jest.getTimerCount()).toBe(1)
    expect(nextButton.click).toHaveBeenCalledTimes(1)
  })

  test('observes attributes only within Shorts and migrates a temporary body observer when Shorts loads', () => {
    shorts.remove()
    boot()
    expect(observers[0].observe).toHaveBeenCalledWith(document.body, { childList: true, subtree: true })
    document.body.appendChild(shorts)
    observers[0].callback([])
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1)
    expect(observers[1].observe).toHaveBeenCalledWith(shorts, expect.objectContaining({
      attributes: true, childList: true, subtree: true
    }))
    expect(jest.getTimerCount()).toBe(1)
  })

  test('rebinds the observer when YouTube replaces the Shorts root', () => {
    boot({ playbackSpeed: 1.5 })
    shorts.remove()
    const replacement = document.createElement('ytd-shorts')
    document.body.appendChild(replacement)
    const current = makeReel(replacement)
    jest.advanceTimersByTime(500)
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1)
    expect(observers[1].observe).toHaveBeenCalledWith(replacement, expect.objectContaining({ attributes: true }))
    expect(current.video.playbackRate).toBe(1.5)
    expect(jest.getTimerCount()).toBe(1)
  })
})
