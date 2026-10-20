# AGENTS.md

## Purpose
- Chrome MV3 extension for YouTube Shorts. Runtime behavior is in `src/content.js`; the popup only controls settings via `chrome.storage.sync` and messages.

## Entry points
- `manifest.json` is the source of truth for wiring.
- Popup UI: `src/popup/popup.html` -> `src/popup/popup.js`
- Content script: `src/content.js`
- There is no background/service worker.

## Repo shape
- Single-package repo. No monorepo boundaries, no build system, no TypeScript.
- App code: `src/`
- Tests: `tests/`
- Assets referenced by manifest/popup: `assets/images/`
- Extension metadata and popup translations: `_locales/en/`, `_locales/zh_TW/`, `_locales/zh_CN/`
- Store copy and reviewer checklist: `store/`; privacy policy: `docs/privacy-policy.md`

## Commands
- Install deps locally: `npm install`
- CI-style install: `npm ci`
- Run all tests: `npm test`
- Run one test file: `npx jest tests/content.test.js` or `npx jest tests/popup.test.js`
- Watch tests: `npm run test:watch`
- Coverage: `npm run test:coverage`
- JavaScript correctness lint: `npm run lint`
- Validate versions, translations, and referenced assets: `npm run validate`
- Build and verify store ZIP: `npm run build` (requires `zip` and `unzip`)

## Test and verification notes
- Jest uses `jsdom` and loads Chrome/DOM mocks from `tests/setup.js`.
- Coverage thresholds are enforced in `jest.config.js`.
- `src/popup/popup.js` is included in coverage and is exercised by integration-style popup tests in `tests/popup.test.js`.
- CI runs on Node 22 and 24, using `npm ci`, lint, coverage tests, and package validation.
- Pushing `v*` tags runs the release checks and publishes the ZIP to GitHub Releases. Chrome Web Store publication is separate.

## Runtime behavior quirks
- `src/content.js` is dual-purpose: browser runtime code plus CommonJS exports for Jest.
- YouTube is treated as an SPA: initialization re-runs on `yt-navigate-finish` and `visibilitychange`, not just initial page load.
- Auto-scroll and sponsored-card skipping are separate toggles. One observer and a 500 ms scan serve the visible Shorts page; there is no separate ad loop.
- All player actions must be limited to the active Shorts card. Regular videos must never be muted, sped up, sought, skipped, or scrolled by the extension.
- The optional ad feature only scrolls past detected Shorts sponsored cards. It does not block requests or bypass YouTube's ad-blocker checks.
- YouTube-wide content script registration supports SPA navigation into Shorts; changing it to only match `/shorts/*` would miss those transitions.

## Gotchas
- `CLAUDE.md` only contains `@AGENTS.md`, so keep this file current; it is the intended repo instruction entrypoint.
- `npm run build` runs `package` to produce a fresh `youtube-shorts-auto-scroll.zip`.
- `scripts/package.js` checks version consistency, locale keys/placeholders, manifest assets, and archive contents; includes `manifest.json`, `src/`, `assets/`, and `_locales/`.
- Keep manifest, package, and lockfile versions consistent. The ZIP excludes docs, tests, tools, and the old demo image.

## Editing guidance
- When changing behavior, inspect `tests/content.test.js` first; it is the best map of expected content-script behavior.
- When changing popup behavior, check both `src/popup/popup.js` and `tests/popup.test.js`; the popup tests include integration-style event-flow coverage for storage hydration, toggle changes, slider updates, and popup-to-content messaging.
