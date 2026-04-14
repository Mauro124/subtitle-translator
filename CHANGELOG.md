# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-04-14

### Added
- **Translation Difficulty Levels**: Users can now select their English proficiency (A1-C2) via the extension popup.
- **Dynamic Filtering**: Content script filters translations in real-time based on selected CEFR threshold.
- **Interactive Popup**: New UI with toggle buttons for level selection and active state persistence.
- **Schema Migration**: `dictionary.json` now includes CEFR level metadata for all 2000+ words.

### Changed
- Improved `content.js` to listen for storage changes and refresh the overlay without page reloads.

## [1.0.0] - 2026-04-14

### Added
- **Initial MVP**: Core architecture for Netflix subtitle translation.
- **Non-Invasive Overlay**: Dedicated `#nwt-overlay` layer to prevent React DOM mutations.
- **Intelligent Positioning**: Logic to place translations above the 1st line and below the 2nd line to avoid overlap.
- **Massive Dictionary**: Support for 2000+ advanced English words via external `dictionary.json`.
- **Word-Level Precision**: Integration with DOM `Range` API for pixel-perfect translation placement.
- **Robust Observation**: `MutationObserver` with `characterData` support to capture in-place text updates.
- **Async Dictionary Loading**: Efficient fetch mechanism for large word databases.
- **Developer Infrastructure**:
    - Git initialization and `.gitignore` setup.
    - Full **SDD (Spec-Driven Development)** documentation in `openspec/`.
    - Comprehensive English `README.md`.

### Fixed
- Fixed UI overlap where translations on the second line obscured the first subtitle line.
- Fixed silent detection failures by implementing deep text node scanning (`TreeWalker`).
- Fixed word matching issues with special characters (ellipses, dashes) by refining regex.
- Improved reliability by adding a 20ms rendering delay for React synchronization.

### Changed
- Migrated hardcoded dictionary from `content.js` to an external JSON file for better maintainability.
- Updated `manifest.json` to Manifest V3 standards with strict `web_accessible_resources`.
