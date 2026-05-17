# AGENTS.md

## Project overview
- Chrome extension for YouTube Shorts auto-scroll and ad skipping.
- Main runtime logic lives in `src/content.js`.
- Tests use Jest with JSDOM under `tests/`.

## Important files
- `manifest.json`: extension entry points and permissions.
- `src/content.js`: Shorts detection, scroll behavior, ad-skip logic, observers, and message handling.
- `src/popup/`: popup UI and toggle behavior.
- `tests/content.test.js`: behavior and DOM-level regression coverage for the content script.
- `tests/popup.test.js`: popup DOM, storage, and messaging coverage.

## Development workflow
1. Install dependencies with `npm install` or `npm ci`.
2. Run tests with `npm test`.
3. Keep extension behavior compatible with both English and Traditional Chinese YouTube labels where possible.
4. Prefer small, targeted changes over broad rewrites.
5. If content-script behavior changes, update or add Jest coverage.

## Implementation notes
- The content script is wrapped in an IIFE and exports helpers for tests via CommonJS.
- Re-initialization can happen on Shorts navigation, visibility changes, and popup toggles, so avoid duplicating event listeners or observers.
- Scroll logic should prefer the native next button, then fall back to scrolling the next reel into view.
- Ad handling should be defensive: selectors may vary across YouTube UI changes.

## Validation
- Primary check: `npm test`
- If packaging scripts are touched, verify `package.json` scripts and the zip contents include files referenced by `manifest.json` and popup assets.

## Style
- Follow the existing plain JavaScript style in the repo.
- Keep comments short and only where they clarify edge cases or YouTube-specific behavior.
