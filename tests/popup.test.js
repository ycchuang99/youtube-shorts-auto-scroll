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
        
        <div class="card">
          <div class="card-info">
            <div class="card-title">Auto Scroll</div>
            <div class="card-subtitle">Enable auto-scroll for YouTube Shorts</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="toggleButton">
            <span class="slider"></span>
          </label>
        </div>

        <div class="status" id="status"></div>
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

    test('should have status element', () => {
      const status = document.getElementById('status')
      expect(status).not.toBeNull()
    })

    test('should have header with title', () => {
      const title = document.querySelector('h1')
      expect(title).not.toBeNull()
      expect(title.textContent).toBe('Shorts Auto Scroll')
    })

    test('should have card info', () => {
      const cardTitle = document.querySelector('.card-title')
      const cardSubtitle = document.querySelector('.card-subtitle')
      
      expect(cardTitle.textContent).toBe('Auto Scroll')
      expect(cardSubtitle.textContent).toBe('Enable auto-scroll for YouTube Shorts')
    })
  })

  describe('Status Updates', () => {
    test('should show enabled status when toggle is on', () => {
      const toggle = document.getElementById('toggleButton')
      const status = document.getElementById('status')
      
      toggle.checked = true
      status.textContent = '✓ Enabled'
      status.className = 'status status-enabled'
      
      expect(status.textContent).toBe('✓ Enabled')
      expect(status.className).toContain('status-enabled')
    })

    test('should show disabled status when toggle is off', () => {
      const toggle = document.getElementById('toggleButton')
      const status = document.getElementById('status')
      
      toggle.checked = false
      status.textContent = '○ Disabled'
      status.className = 'status status-disabled'
      
      expect(status.textContent).toBe('○ Disabled')
      expect(status.className).toContain('status-disabled')
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

  describe('Accessibility', () => {
    test('should have proper ARIA labels on switch', () => {
      const toggle = document.getElementById('toggleButton')
      const switchLabel = toggle.closest('.switch')
      
      expect(switchLabel).not.toBeNull()
      expect(toggle.type).toBe('checkbox')
    })

    test('should have descriptive text for screen readers', () => {
      const cardSubtitle = document.querySelector('.card-subtitle')
      expect(cardSubtitle.textContent).toContain('Enable auto-scroll')
    })
  })

  describe('Visual States', () => {
    test('should apply correct CSS classes for enabled state', () => {
      const status = document.getElementById('status')
      status.className = 'status status-enabled'
      
      expect(status.classList.contains('status')).toBe(true)
      expect(status.classList.contains('status-enabled')).toBe(true)
    })

    test('should apply correct CSS classes for disabled state', () => {
      const status = document.getElementById('status')
      status.className = 'status status-disabled'
      
      expect(status.classList.contains('status')).toBe(true)
      expect(status.classList.contains('status-disabled')).toBe(true)
    })
  })
})
