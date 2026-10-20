# Chrome Web Store submission — 1.4.0

This is an update to the existing item `ejiondkplaoolmmnepmpipdpaeibfjen`, not a new listing.

## Upload and listing

1. Run `npm ci`, `npm run lint`, `npm run test:coverage`, and `npm run build`.
2. Upload `youtube-shorts-auto-scroll.zip` to the existing Chrome Web Store item. The ZIP includes the manifest, runtime, popup, icons, and all three `_locales` folders.
3. Update English, Traditional Chinese, and Simplified Chinese listings from their `store/listing-*.md` files. Copy field contents, not Markdown section headings.
4. Use current popup screenshots and remove images or text that promise to skip all ads or operate on regular videos.
5. Set the homepage to `https://github.com/ycchuang99/youtube-shorts-auto-scroll` and support URL to `https://github.com/ycchuang99/youtube-shorts-auto-scroll/issues`.
6. Set the privacy policy URL to `https://github.com/ycchuang99/youtube-shorts-auto-scroll/blob/main/docs/privacy-policy.md` after that file is published and reachable.
7. Review the permission explanations and privacy declarations below, save the changes, then submit for review. Report “submitted” or “in review” until the dashboard actually confirms publication.

The GitHub release workflow runs on a version tag such as `v1.4.0`, checks that the tag matches the package version, and attaches the verified ZIP. It does not submit to Chrome Web Store.

## Screenshots

Use `assets/screenshot-en.jpg`, `assets/screenshot-zh-TW.jpg`, and `assets/screenshot-zh-CN.jpg` for the matching localized listings. Each is a 1280×800 JPEG.

`preview.html?lang=en` (or `zh_TW` / `zh_CN`) renders the actual popup HTML and CSS with sample Chrome API responses for reproducible screenshots. Serve the repository root locally before opening it. These preview files are not included in the extension ZIP.

## Single purpose

Provide automatic navigation and playback controls for the YouTube Shorts feed, including optional scrolling past sponsored cards within that feed.

## Permission explanations

- **storage:** Save the user's auto-scroll, sponsored-card skip, and playback speed preferences with `chrome.storage.sync`. Chrome may synchronize these preferences through the user's account when browser sync is enabled.
- **YouTube content-script access (`*://*.youtube.com/*`):** YouTube navigates between home, regular videos, and Shorts without reloading the page. Registering the script on YouTube lets it detect entry into Shorts even when the user did not initially load a Shorts URL. Every player action is scoped to the active Shorts card, and Shorts processing stops on other routes.

Version 1.4.0 removes the unused `activeTab` permission. The popup uses only the active tab's ID to send settings changes and does not inspect its URL or title. Remove the old `activeTab` justification when updating the dashboard.

## Privacy declarations

- No analytics, external telemetry, or publisher-operated data collection endpoints.
- No collection of browsing history, video titles, watch activity, authentication information, payments, or personal communications.
- Page elements and playback events are processed locally only to provide the requested Shorts behavior.
- Preferences use Chrome sync storage; do not claim that no data can ever leave the device.
- No remotely hosted executable code. All scripts are bundled in the upload.
- No network interception or request blocking.
- The publisher does not sell data or use it for unrelated advertising or credit decisions.

Use the dashboard's current definitions for data disclosures. The privacy policy describes Chrome-managed preference syncing separately from publisher collection.

## Reviewer instructions

No extension account, subscription, or special credentials are required. YouTube availability and ads depend on region, account, and YouTube's current interface.

1. Install the extension and reload any already open YouTube pages.
2. Open a public YouTube Shorts video. Enable auto-scroll; when the active Short ends, confirm the feed advances to the next card.
3. Disable auto-scroll and confirm it no longer advances normal Shorts automatically.
4. Choose 0.5×, 0.75×, 1×, 1.5×, or 2× in the popup. Confirm the selected speed applies to the active normal Short.
5. Enable “Skip Shorts ads” (wording is localized). When YouTube serves a recognizable sponsored Shorts card, confirm the extension scrolls to the next card. It does not mute, accelerate, seek through, or click a video ad's skip button.
6. Disable sponsored-card skipping. Detected sponsored cards should not be scrolled automatically or have their playback speed changed by the extension.
7. Navigate from Shorts to a regular YouTube video without reloading. Confirm the extension does not change the regular player's speed, muted state, current time, or navigation, even if the settings remain enabled.
8. Start from the YouTube home page or a regular video, then enter Shorts through YouTube's navigation. Confirm Shorts controls activate without requiring an extra reload.
9. Verify popup language in English, Traditional Chinese, and Simplified Chinese browser locales, and confirm preferences remain selected after reopening the popup.

## Changes for this review

Version 1.4.0 limits player actions to Shorts, removes the regular-video ad manipulation from earlier versions, stops Shorts processing when leaving the feed, and removes the unused `activeTab` permission. It adds localized metadata and popup strings and clarifies sponsored-card skipping and settings sync. It does not promise to bypass YouTube's ad-blocker checks or guarantee ad-free playback.
