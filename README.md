# Netflix Word Translator 🎬

A Chrome Extension (Manifest V3) designed to help you master advanced English while watching Netflix. It automatically translates complex words within subtitles and displays them in a non-invasive overlay, ensuring a seamless and high-performance learning experience.

## ✨ Key Features

- **Non-Invasive Overlay Architecture**: Translations are rendered in a parallel layer over the video. **Zero Netflix DOM mutations**, preventing conflicts with its internal React state and Virtual DOM.
- **Intelligent Positioning**: 
  - **First-line** translations appear above the word.
  - **Second-line** translations appear below the word.
  - This "outward" positioning prevents labels from overlapping each other or obscuring the original text.
- **Massive Dictionary (2000+ words)**: Focused on advanced vocabulary (C1/C2, GRE, TOEFL levels) and technical terminology.
- **O(1) Performance**: Instant word lookups using an in-memory `Map`, ensuring zero lag during video playback.
- **Robust Synchronization**: Uses `MutationObserver` with `characterData` support to detect subtitle changes even when Netflix updates text without changing DOM elements.

## 🚀 Local Installation

1. Clone this repository or download the source files.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **"Developer mode"** (top right corner).
4. Click on **"Load unpacked"**.
5. Select the folder containing the extension files.

## 🛠️ Project Structure

- `manifest.json`: Extension configuration (Manifest V3).
- `content.js`: Core logic (Observer, word detection, and overlay rendering).
- `dictionary.json`: External database for words and translations.
- `styles.css`: Styling for the transparent container and translation labels.
- `openspec/`: Detailed technical documentation following the **SDD (Spec-Driven Development)** methodology.

## 🧠 Technical Decisions

- **DOM Range API**: Used to calculate precise screen coordinates for specific words within text nodes without wrapping them in extra HTML elements.
- **Async Loading**: The dictionary is fetched asynchronously at startup to keep the content script lightweight.
- **Smart Cleanup**: The overlay is automatically cleared when subtitles disappear from the viewport.

## 📝 License

This project is an MVP developed for educational and language-learning purposes.
