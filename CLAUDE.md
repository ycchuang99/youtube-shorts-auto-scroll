# CLAUDE.md

## Repository purpose
This repository contains a Chrome extension that automatically advances YouTube Shorts and can skip ads when possible.

## Code map
- `manifest.json`: extension manifest and asset references.
- `src/content.js`: content-script behavior for Shorts auto-scroll and ad skipping.
- `src/popup/`: popup interface and toggle state wiring.
- `tests/content.test.js`: content-script regression tests.
- `tests/popup.test.js`: popup UI and chrome API mock tests.

## Working agreements
- Keep changes focused and easy to review.
- Do not remove compatibility fallbacks unless there is test coverage proving the replacement path.
- When touching runtime selectors, assume YouTube DOM may differ by locale and experiment bucket.
- Preserve testability: helper functions exposed for Jest should remain stable unless tests are updated in the same change.

## Recommended commands
```bash
npm ci
npm test
```

## Before finishing a change
- Run `npm test`.
- If packaging or assets changed, make sure every icon or image referenced from `manifest.json` and popup HTML is included in the packaged output.
- Check for duplicated listeners, timers, or observers after re-init paths.

## Notes for future edits
- The project currently uses plain JavaScript and Jest; keep new tooling lightweight unless there is a strong reason.
- Favor pragmatic fixes for YouTube DOM changes over large abstractions.
