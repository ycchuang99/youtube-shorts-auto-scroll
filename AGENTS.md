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

## Commands
- Install deps locally: `npm install`
- CI-style install: `npm ci`
- Run all tests: `npm test`
- Run one test file: `npx jest tests/content.test.js` or `npx jest tests/popup.test.js`
- Watch tests: `npm run test:watch`
- Coverage: `npm run test:coverage`

## Test and verification notes
- Jest uses `jsdom` and loads Chrome/DOM mocks from `tests/setup.js`.
- Coverage thresholds are enforced in `jest.config.js`.
- `src/popup/popup.js` is included in coverage and is exercised by integration-style popup tests in `tests/popup.test.js`.
- CI runs on Node 18 and 20, using `npm ci` then `npm run test:coverage`.

## Runtime behavior quirks
- `src/content.js` is dual-purpose: browser runtime code plus CommonJS exports for Jest.
- YouTube is treated as an SPA: initialization re-runs on `yt-navigate-finish` and `visibilitychange`, not just initial page load.
- Auto-scroll and ad-skip are separate toggles. Ad-skip has its own polling/observer loop.

## Gotchas
- `CLAUDE.md` only contains `@AGENTS.md`, so keep this file current; it is the intended repo instruction entrypoint.
- `npm run build` currently works: it runs `clean` then `package` to produce `youtube-shorts-auto-scroll.zip`.
- `npm run package` includes `manifest.json`, `src/`, and `assets/`, so the generated zip contains the referenced popup and manifest assets.

## Editing guidance
- When changing behavior, inspect `tests/content.test.js` first; it is the best map of expected content-script behavior.
- When changing popup behavior, check both `src/popup/popup.js` and `tests/popup.test.js`; the popup tests include integration-style event-flow coverage for storage hydration, toggle changes, slider updates, and popup-to-content messaging.
