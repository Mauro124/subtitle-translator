/**
 * Netflix Word Translator Content Script
 * 
 * Architectural Pattern: Non-invasive Overlay.
 */

let DICTIONARY = new Map();
const LEVEL_MAP = { 'A1': 1, 'A2': 2, 'B1': 3, 'B2': 4, 'C1': 5, 'C2': 6 };

// Sorted phrase keys by descending word-count for longest-match-first lookup.
// Rebuilt once after dictionary loads. Only includes multi-word entries.
let PHRASE_KEYS = [];

class NetflixTranslator {
  constructor() {
    this.overlay = null;
    this.observer = null;
    this.observedNode = null; // Track the node the observer is watching
    this.isDictionaryLoaded = false;
    this.selectedLevelValue = 1; // Default to A1 (show all)
    this.init();
  }

  /**
   * Initialize the dictionary, overlay, and observer.
   */
  async init() {
    // 1. Load dictionary and user settings
    try {
      const [dictResponse, settings] = await Promise.all([
        fetch(chrome.runtime.getURL('dictionary.json')),
        chrome.storage.local.get('selectedLevel')
      ]);

      if (!dictResponse.ok) throw new Error(`HTTP status ${dictResponse.status}`);
      const data = await dictResponse.json();
      DICTIONARY = new Map(Object.entries(data));

      // Build phrase index: multi-word keys only, sorted longest first.
      PHRASE_KEYS = [...DICTIONARY.keys()]
        .filter(k => k.includes(' '))
        .sort((a, b) => b.split(' ').length - a.split(' ').length);

      this.isDictionaryLoaded = true;

      if (settings.selectedLevel) {
        this.selectedLevelValue = LEVEL_MAP[settings.selectedLevel] || 1;
      }

      // T006: Listen for real-time changes
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.selectedLevel) {
          this.selectedLevelValue = LEVEL_MAP[changes.selectedLevel.newValue] || 1;
          // FIX #3: Only clear — the live Observer handles the next subtitle cycle.
          // Re-processing the container root here is a no-op: DOM Ranges are only
          // valid during the current paint cycle, so getBoundingClientRect() returns
          // zeros for already-rendered nodes. Let MutationObserver do it naturally.
          this.clearOverlay();
        }
      });
    } catch (e) {
      console.error("NWT: Failed to load dictionary or settings", e);
      return; 
    }

    const checkReady = setInterval(() => {
      const container = document.querySelector('.player-timedtext') || document.querySelector('.watch-video--timed-text-container');
      const video = document.querySelector('video');
      
      if (container && video && this.isDictionaryLoaded) {
        clearInterval(checkReady);
        this.setupOverlay(video);
        this.setupObserver(container);
        this.processNode(container);
        this.startSentinel(); // FIX #2: Watch for Netflix DOM replacement between episodes
      }
    }, 1000);
  }

  /**
   * Create and attach the translation overlay.
   * @param {HTMLVideoElement} video 
   */
  setupOverlay(video) {
    if (document.getElementById('nwt-overlay')) return;

    this.overlay = document.createElement('div');
    this.overlay.id = 'nwt-overlay';
    
    const container = video.parentElement;
    container.style.position = container.style.position || 'relative';
    container.appendChild(this.overlay);
  }

  /**
   * Observe subtitle container for text changes.
   * @param {HTMLElement} container 
   */
  setupObserver(container) {
    this.observedNode = container; // FIX #2: Track for sentinel checks

    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            setTimeout(() => this.processNode(node), 20);
          });
        } else if (mutation.type === 'characterData') {
          setTimeout(() => this.processNode(mutation.target), 20);
        }
        
        if (container.childNodes.length === 0) {
          this.clearOverlay();
        }
      });
    });

    this.observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  /**
   * FIX #2: Periodically verify the observed node is still in the live DOM.
   * Netflix replaces `.player-timedtext` between episodes, silently detaching the observer.
   */
  startSentinel() {
    setInterval(() => {
      if (this.observedNode && !document.contains(this.observedNode)) {
        console.log('NWT: Subtitle node detached — re-initializing observer.');
        if (this.observer) this.observer.disconnect();
        this.clearOverlay();

        const newContainer = document.querySelector('.player-timedtext') || document.querySelector('.watch-video--timed-text-container');
        const newVideo = document.querySelector('video');

        if (newContainer && newVideo) {
          this.setupOverlay(newVideo);
          this.setupObserver(newContainer);
        }
      }
    }, 2000);
  }

  /**
   * Process a node to find target words.
   * @param {Node} node 
   */
  processNode(node) {
    if (!node) return;
    
    if (node.nodeType === Node.TEXT_NODE) {
      this.checkAndTranslateText(node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null, false);
      let textNode;
      while (textNode = walker.nextNode()) {
        this.checkAndTranslateText(textNode);
      }
    }
  }

  /**
   * Resolve the best translation for an entry given sentence context.
   *
   * Priority:
   *   1. translation_question  — if the subtitle is a question AND the entry has it
   *   2. translation_start     — if the token is in the first 20% AND the entry has it
   *   3. translation_end       — if the token is in the last 20% AND the entry has it
   *   4. translation           — default fallback
   *
   * @param {Object} entry         - Dictionary entry
   * @param {boolean} isQuestion   - Whether the full subtitle ends with '?'
   * @param {number}  posRatio     - Word position (0 = first word, 1 = last word)
   * @returns {string}
   */
  resolveTranslation(entry, isQuestion, posRatio) {
    if (isQuestion && entry.translation_question) return entry.translation_question;
    if (posRatio <= 0.20 && entry.translation_start) return entry.translation_start;
    if (posRatio >= 0.80 && entry.translation_end)   return entry.translation_end;
    return entry.translation;
  }

  /**
   * Tokenize subtitle text and look up phrases/words using longest-match-first.
   *
   * Algorithm:
   *   1. Split text into tokens (words + non-word separators), tracking char offsets.
   *   2. At each word token, try to match the longest phrase in PHRASE_KEYS first.
   *   3. If a multi-word phrase matches, inject it and skip all its tokens.
   *   4. If no phrase matches, fall back to the single word lookup.
   *
   * This ensures "look who's talking" is translated as a phrase, not "look" + "who" separately.
   *
   * @param {Text} textNode
   */
  checkAndTranslateText(textNode) {
    const originalText = textNode.textContent;
    if (!originalText || originalText.trim().length < 3) return;

    // Context signals derived from the whole subtitle line.
    const isQuestion = originalText.trim().endsWith('?');
    // Split into alternating [word, separator, word, separator …] tokens with offsets.
    // Each token: { text, start, end, isWord }
    const TOKEN_RE = /([a-zA-Z']+)|([^a-zA-Z']+)/g;
    const tokens = [];
    let m;
    while ((m = TOKEN_RE.exec(originalText)) !== null) {
      tokens.push({
        text: m[0],
        start: m.index,
        end: m.index + m[0].length,
        isWord: /[a-zA-Z]/.test(m[0])
      });
    }

    // Word tokens only, in order — we iterate these for matching.
    const wordTokens = tokens.filter(t => t.isWord);
    const totalWords = wordTokens.length;

    // Track which word-token indices are already covered by a phrase match.
    const covered = new Set();

    // --- Phase 1: longest-match phrase scan ---
    for (let wi = 0; wi < wordTokens.length; wi++) {
      if (covered.has(wi)) continue;

      // Position ratio: 0 = first word of subtitle, 1 = last word.
      const posRatio = totalWords <= 1 ? 0.5 : wi / (totalWords - 1);

      // Build candidate windows from this word position outward.
      // Max phrase length in the dictionary (capped at 8 words for perf).
      const maxLen = Math.min(8, wordTokens.length - wi);

      let matched = false;
      for (let len = maxLen; len >= 2; len--) {
        // Reconstruct the candidate string from word wi to wi+len-1,
        // preserving original separators between them.
        const firstToken = wordTokens[wi];
        const lastToken  = wordTokens[wi + len - 1];
        const candidate  = originalText.slice(firstToken.start, lastToken.end).toLowerCase()
          .replace(/['']/g, "'");  // normalise smart quotes

        const entry = DICTIONARY.get(candidate);
        if (entry) {
          const lvl = LEVEL_MAP[entry.level] || 6;
          if (lvl >= this.selectedLevelValue) {
            // Phrases always use position of first token.
            const translation = this.resolveTranslation(entry, isQuestion, posRatio);
            const isStructural = Array.isArray(entry.tags) &&
              (entry.tags.includes('connector') || entry.tags.includes('auxiliary'));
            this.injectTranslation(textNode, firstToken.start, lastToken.end, translation, isStructural);
          }
          // Mark all consumed word-token positions as covered.
          for (let k = wi; k < wi + len; k++) covered.add(k);
          wi += len - 1; // advance outer loop past matched tokens
          matched = true;
          break;
        }
      }

      if (matched) continue;

      // --- Phase 2: single-word fallback ---
      const token = wordTokens[wi];
      const normalized = token.text.toLowerCase();
      const entry = DICTIONARY.get(normalized);
      if (entry) {
        const lvl = LEVEL_MAP[entry.level] || 6;
        if (lvl >= this.selectedLevelValue) {
          const translation = this.resolveTranslation(entry, isQuestion, posRatio);
          const isStructural = Array.isArray(entry.tags) &&
            (entry.tags.includes('connector') || entry.tags.includes('auxiliary'));
          this.injectTranslation(textNode, token.start, token.end, translation, isStructural);
        }
      }
    }
  }

  /**
   * Inject a translation label into the overlay at precise word coordinates.
   * @param {Text}    textNode
   * @param {number}  startOffset
   * @param {number}  endOffset
   * @param {string}  translation
   * @param {boolean} [isConnector=false] - Whether this is a grammatical connector (different style)
   */
  injectTranslation(textNode, startOffset, endOffset, translation, isConnector = false) {
    if (!this.overlay) return;

    try {
      const range = document.createRange();
      range.setStart(textNode, startOffset);
      range.setEnd(textNode, endOffset);
      
      const rect = range.getBoundingClientRect();
      const overlayRect = this.overlay.getBoundingClientRect();

      // FIX #1: If overlay has no dimensions yet, coordinates will be wrong (0,0).
      // Skip this cycle — the observer will fire again on the next subtitle.
      if (overlayRect.width === 0) return;

      const left = rect.left - overlayRect.left + (rect.width / 2);
      
      const subtitleContainer = textNode.parentElement.closest('.player-timedtext-text-container');
      let isSecondLine = false;
      
      if (subtitleContainer) {
        const containerRect = subtitleContainer.getBoundingClientRect();
        if ((rect.top - containerRect.top) > (containerRect.height * 0.4)) {
          isSecondLine = true;
        }
      }

      const label = document.createElement('span');
      label.className = isConnector ? 'nwt-translation nwt-connector' : 'nwt-translation';
      label.textContent = translation;
      label.style.left = `${left}px`;

      if (isSecondLine) {
        label.style.top = `${rect.bottom - overlayRect.top}px`;
        label.style.transform = `translate(-50%, 15%)`;
      } else {
        label.style.top = `${rect.top - overlayRect.top}px`;
        label.style.transform = `translate(-50%, -125%)`;
      }

      this.overlay.appendChild(label);
    } catch (e) {}
  }

  /**
   * Clear all translations from the overlay.
   */
  clearOverlay() {
    if (this.overlay) {
      this.overlay.innerHTML = '';
    }
  }
}

new NetflixTranslator();
