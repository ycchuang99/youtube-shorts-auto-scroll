// Mock Chrome APIs
global.__chromeRuntimeMessageListener = null
global.__chromeRuntimeMessageListeners = []

global.chrome = {
  storage: {
    sync: {
      get: jest.fn((keys, callback) => {
        const result = { enabled: true, adSkipEnabled: true, playbackSpeed: 1.0 }
        if (callback) callback(result)
        return Promise.resolve(result)
      }),
      set: jest.fn((items, callback) => {
        if (callback) callback()
        return Promise.resolve()
      })
    }
  },
  runtime: {
    onMessage: {
      addListener: jest.fn((listener) => {
        global.__chromeRuntimeMessageListener = listener
        global.__chromeRuntimeMessageListeners.push(listener)
      })
    }
  },
  tabs: {
    query: jest.fn(() => Promise.resolve([{ id: 1, url: 'https://youtube.com/shorts/test' }])),
    sendMessage: jest.fn(() => Promise.resolve())
  }
}

// Mock DOM APIs
global.MutationObserver = class {
  constructor(callback) {
    this.callback = callback
  }
  observe() {}
  disconnect() {}
}
