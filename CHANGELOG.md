# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-04-14

### Added
- **Customizable Label Appearance**: Users can now control how translation labels look from the popup:
  - **Color** — color picker + 6 quick presets (green, white, gold, cyan, red, purple)
  - **Font Size** — slider from 10px to 22px with live numeric display
  - **Font Family** — Netflix Sans, Inter, Monospace, Georgia, System UI
  - **Connector/Auxiliary Color** — separate picker + presets for structural words
  - **Live Preview** — shows how labels will look before opening Netflix
  - **Reset to defaults** — one-click restore
- **CSS Custom Properties system**: All label styles are now driven by `--nwt-color`, `--nwt-font-size`, `--nwt-font-family`, `--nwt-connector-color` on the overlay element. Changes from the popup are applied instantly via `applyAppearanceVars()` — no DOM iteration required.
- **Popup redesign**: New interface inspired by the extension icon (ES/EN badges, blue gradient header, dark theme, Inter typography). Sections: Proficiency Level, Label Appearance, Structural Color.

### Changed
- App renamed from **Netflix Word Translator** to **Subtitle Translator** across `manifest.json`, `popup.html`, and `README.md`.
- `init()` now loads all appearance settings alongside `selectedLevel` in a single `storage.local.get` call.
- `storage.onChanged` listener extended to react to all five persisted settings in real time (no reload needed).

## [1.2.0] - 2026-04-14

### Added
- **Context-Aware Translations**: Words now resolve their best translation based on sentence context:
  - `translation_question` — activated when the subtitle ends with `?` (e.g. `who` → `¿quién?`)
  - `translation_start` — activated for words in the first 20% of a sentence (e.g. `well` → `bueno / pues`)
  - `translation_end` — activated for words in the last 20% (e.g. `right` → `¿no? / ¿verdad?`)
- **Longest-Match-First Phrase Detection**: Multi-word expressions now take priority over individual words. `"look who's talking"` is translated as a phrase, never as `"look"` + `"who"` separately.
- **Structural Word Differentiation**: Connectors and auxiliary verbs are now visually distinct — rendered in muted gray-blue (smaller, non-bold) to focus attention on content vocabulary.
  - **55 connectors** tagged: `and`, `but`, `however`, `although`, `therefore`, `whereas`, `albeit`, and more.
  - **27 auxiliary verbs** tagged: `can`, `will`, `would`, `should`, `must`, `do`, `have`, `be`, and all conjugations.
- **Massive Dictionary Expansion**: 3,140 real entries (up from ~1,300), focused on subtitle realism:
  - 652 idioms, 510 informal expressions, 301 phrasal verbs, 98 slang
  - 5 topic batches: conversational/daily, crime/thriller, relationships/romance, sci-fi/action/fantasy
  - Zero fake placeholder entries (`complexWord189` style fully removed)
- **Tooling**:
  - `scripts/merge-dictionary.py` — merge new batches without overwriting existing entries
  - `scripts/patch-context.py` — apply context patches (`translation_start/end/question`, tags) to existing entries

### Changed
- `checkAndTranslateText()` rewritten with a tokenizer-based approach: tracks char offsets, supports multi-word windows, and propagates context signals (`isQuestion`, `posRatio`) to every lookup.
- `injectTranslation()` now accepts an `isStructural` flag to apply the `.nwt-connector` CSS class.
- Dictionary schema extended with optional `translation_start`, `translation_end`, `translation_question`, and `tags` fields.

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
