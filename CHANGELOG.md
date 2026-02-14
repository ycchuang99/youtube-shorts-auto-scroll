# Changelog

All notable changes to the YouTube Shorts Auto Scroll extension will be documented in this file.

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
