# Changelog

All notable changes to the YouTube Shorts Auto Scroll extension will be documented in this file.

## [1.2.0] - 2026-02-14

### Added
- **🎯 Auto-skip ads feature** - Automatically detects and skips YouTube ads in Shorts and regular videos
- **Hybrid ad-skip approach** - Speeds up ads to 10x playback + auto-clicks skip button when available
- **Multi-selector fallback chain** - Works with 5+ skip button selector variants for maximum compatibility
- **Dual detection system** - MutationObserver + 500ms interval for reliable ad detection
- **Toggleable ad skip** - New "Auto-skip Ads" toggle in popup UI
- **Persistent preferences** - Ad skip setting saved via chrome.storage.sync

### Technical Implementation
- `isAdPlaying()` - Detects ads via `#movie_player` classes (`ad-showing`, `ad-interrupting`) and skip button presence
- `tryClickSkipButton()` - Multi-selector click handler (`.ytp-ad-skip-button-modern`, `.ytp-ad-skip-button`, etc.)
- `handleAd()` - Mutes video, speeds to 10x, attempts skip button click, restores playback after ad
- `initAdSkip()` - Initializes MutationObserver on `#movie_player` + 500ms polling interval
- `stopAdSkip()` - Cleanup function disconnects observers, clears intervals, restores video state

### UI Changes
- New "Auto-skip Ads" card in popup with toggle switch
- Updated status messages: "✓ Both enabled", "✓ Auto-scroll enabled", "✓ Ad skip enabled"
- Consistent styling with existing auto-scroll toggle

### Verified
- ✅ All 70 unit tests pass
- ✅ Works on YouTube Shorts and regular videos
- ✅ No breaking changes to existing functionality
- ✅ Zero console errors
- ✅ Proper cleanup on disable/unload

## [1.1.1] - 2026-02-14

### Fixed
- **CRITICAL**: Fixed auto-scroll feature broken by YouTube's removal of `is-active` attribute
- Extension now uses viewport visibility detection instead of relying on YouTube's internal attributes
- MutationObserver now watches for DOM childList changes in addition to attribute changes
- Added backward compatibility fallback for `is-active` attribute if YouTube restores it

### Added
- New helper function `getActiveVideo()` - Finds active video using visibility detection
- New helper function `getActiveReel()` - Finds active reel container using visibility detection  
- New helper function `isElementVisible()` - Checks if element is visible in viewport
- All helper functions exported for comprehensive unit testing

### Technical Details
- Replaced broken selector `ytd-reel-video-renderer[is-active]` with robust visibility-based detection
- Enhanced MutationObserver to watch both attributes and childList mutations
- Maintains all existing functionality and test coverage (54/54 tests passing)
- Zero breaking changes to public API

### Verified
- ✅ All 54 unit tests pass
- ✅ Tested on live YouTube Shorts (Feb 14, 2026)
- ✅ Successfully navigates between videos
- ✅ No console errors
- ✅ Works with current YouTube DOM structure

## [1.1.0] - Previous Release

(Earlier versions not documented)
