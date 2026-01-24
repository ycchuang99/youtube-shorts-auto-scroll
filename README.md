# <img src="assets/images/scroll-icon-128.png" alt="Scroll Icon" width="24" height="24" /> YouTube Shorts Auto Scroll

A browser extension that automatically scrolls to the next YouTube Shorts video when the current one ends.

## Features

- ✨ Beautiful modern UI with dark mode support
- 🎯 Auto-scroll to next video when current video ends
- 🌍 Multi-language support (English, Chinese)
- 🔄 Smart fallback mechanism (button click → scroll)
- ⚙️ Works on any domain (no restrictions)
- ✅ 73% test coverage with 54 unit tests

## Install

### Chrome/Edge

1. Open Chrome and go to [youtube-shorts-auto-scroll](https://chromewebstore.google.com/detail/youtube-shorts-auto-scrol/ejiondkplaoolmmnepmpipdpaeibfjen?hl=zh-TW)
2. Click "Add extension"
3. Enjoy your YouTube shorts video

## Development

### Testing

```bash
npm install           # Install dependencies
npm test             # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```

**Test Stats:**
- 54 unit tests (all passing ✅)
- 73% code coverage
- Automated CI/CD with GitHub Actions

### Building

```bash
# Zip for distribution
zip -r youtube-shorts-auto-scroll.zip . \
  -x "*.git*" -x "*.DS_Store" -x "node_modules/*" -x "tests/*" -x "coverage/*"
```

## Demo

![Demo](assets/images/demo.png)
