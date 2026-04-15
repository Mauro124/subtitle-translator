# Subtitle Translator 🎬

A Chrome Extension (Manifest V3) that helps you master English while watching series or movies. It automatically translates words and expressions within subtitles using a non-invasive overlay — with full control over appearance and learning level.

## ✨ Key Features

- **Customizable Appearance**: Full control over how translation labels look — chooseable color (with presets), font size (slider), and font family. Separate color for structural words. Live preview before touching series or movies.
- **Non-Invasive Overlay Architecture**: Translations are rendered in a parallel layer over the video. **Zero series or movies DOM mutations**, preventing conflicts with its internal React state and Virtual DOM.
- **Translation Difficulty Levels**: Select your English proficiency (A1–C2) from the extension popup. Filter out common words and focus on terms that match your learning level.
- **Longest-Match-First Phrase Detection**: Multi-word expressions are matched before individual words. `"look who's talking"` translates as a full phrase — never as `"who"` alone.
- **Context-Aware Translations**: Each word resolves its best translation based on sentence context:
  - **Question context** — `"Who is that?"` shows `¿quién?` instead of `quien`
  - **Sentence-start** — `"Well, I suppose..."` shows `bueno / pues`, not just `bien`
  - **Sentence-end** — `"That's strange, right?"` shows `¿no? / ¿verdad?`
- **Structural Word Differentiation**: Connectors (`and`, `however`, `although`) and auxiliary verbs (`can`, `will`, `should`) are shown in a **muted gray-blue** style — visually distinct from content vocabulary so learners focus on what matters.
- **Subtitle-Optimized Dictionary (3,140+ entries)**: 100% real entries focused on how English is actually spoken in movies and TV:
  - 652 idioms · 510 informal expressions · 301 phrasal verbs · 98 slang
  - Covers: everyday speech, crime/thriller, romance, sci-fi/action/fantasy
- **Intelligent Positioning**:
  - **First-line** translations appear above the word.
  - **Second-line** translations appear below the word.
- **O(1) Performance**: Instant word lookups using an in-memory `Map`, ensuring zero lag during video playback.
- **Robust Synchronization**: `MutationObserver` with `characterData` support detects subtitle changes even when series or movies updates text in place.
- **Manual Page Reload**: Dedicated button in the popup to refresh the tab and force-apply level or style settings if needed.
- **Project Support Integration**: Built-in link to the project's Cafecito page in the popup footer for community contributions.

## 🚀 Local Installation

1. Clone this repository or download the source files.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **"Developer mode"** (top right corner).
4. Click on **"Load unpacked"**.
5. Select the folder containing the extension files.

## 🛠️ Project Structure

- `manifest.json` — Extension configuration (Manifest V3).
- `content.js` — Core logic: tokenizer, phrase detection, context-aware lookup, overlay rendering.
- `dictionary.json` — 3,140+ word/phrase database with CEFR levels, tags and context translations.
- `styles.css` — Overlay and label styling, including structural word differentiation.
- `popup.html / popup.js / popup.css` — Extension popup for selecting CEFR level.
- `scripts/merge-dictionary.py` — Tool to add new word batches without overwriting existing entries.
- `scripts/patch-context.py` — Tool to apply context patches (`translation_start/end/question`, tags) to existing entries.
- `openspec/` — Technical documentation following the **SDD (Spec-Driven Development)** methodology.

## 🧠 Technical Decisions

- **Tokenizer + Longest-Match**: `checkAndTranslateText()` splits text into word tokens with char offsets, then tries multi-word windows (up to 8 tokens) before falling back to single-word lookup. This gives phrase detection without any NLP library.
- **Context Signals via `posRatio`**: Each token gets a position ratio (0–1) within the subtitle. The first 20% activates `translation_start`, the last 20% activates `translation_end`. Question detection uses a simple `endsWith('?')` check on the full subtitle line.
- **DOM Range API**: Pixel-perfect translation placement by querying `getBoundingClientRect()` on the exact char range — no HTML wrapping needed.
- **Async Loading + PHRASE_KEYS Index**: Dictionary is fetched once at startup. Multi-word keys are pre-sorted by descending word count into `PHRASE_KEYS` for efficient longest-match scanning.
- **Smart Cleanup**: Overlay clears automatically when subtitles disappear; `startSentinel()` re-initializes the observer if series or movies replaces the subtitle DOM between episodes.

## 📝 License

This project is an MVP developed for educational and language-learning purposes.
