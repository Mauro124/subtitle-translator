/**
 * Multi-Platform Subtitle Translator Content Script
 */
console.log('ST: Content script loaded');

let DICTIONARY = new Map();
const LEVEL_MAP = { 'A1': 1, 'A2': 2, 'B1': 3, 'B2': 4, 'C1': 5, 'C2': 6 };

// Sorted phrase keys by descending word-count for longest-match-first lookup.
let PHRASE_KEYS = [];

class SubtitleTranslator {
  constructor() {
    this.overlay = null;
    this.observer = null;
    this.observedNode = null;
    this.isDictionaryLoaded = false;
    this.selectedLevelValue = 1;
    this.isEnabled = true;
    this.checkReadyInterval = null;
    this.sentinelInterval = null;
    
    // Appearance defaults
    this.labelColor      = '#00ff00';
    this.labelFontSize   = 13;
    this.labelFontFamily = "'Netflix Sans', Arial, sans-serif";
    this.connectorColor  = '#90b8d0';

    // Platform handling
    this.adapters = [
      new NetflixAdapter(),
      new YouTubeAdapter(),
      new DisneyAdapter(),
      new BaseAdapter() // Generic fallback
    ];
    this.activeAdapter = null;

    this.init();
  }

  /**
   * Initialize dictionary, settings, and start the platform engine.
   */
  async init() {
    try {
      const [dictResponse, settings] = await Promise.all([
        fetch(chrome.runtime.getURL('dictionary.json')),
        chrome.storage.local.get(['isEnabled', 'selectedLevel', 'labelColor', 'labelFontSize', 'labelFontFamily', 'connectorColor'])
      ]);

      if (!dictResponse.ok) throw new Error(`HTTP status ${dictResponse.status}`);
      const data = await dictResponse.json();
      DICTIONARY = new Map(Object.entries(data));

      PHRASE_KEYS = [...DICTIONARY.keys()]
        .filter(k => k.includes(' '))
        .sort((a, b) => b.split(' ').length - a.split(' ').length);

      this.isDictionaryLoaded = true;

      this.isEnabled = settings.isEnabled !== false;
      if (settings.selectedLevel)  this.selectedLevelValue = LEVEL_MAP[settings.selectedLevel] || 1;
      if (settings.labelColor)     this.labelColor      = settings.labelColor;
      if (settings.labelFontSize)  this.labelFontSize   = settings.labelFontSize;
      if (settings.labelFontFamily) this.labelFontFamily = settings.labelFontFamily;
      if (settings.connectorColor) this.connectorColor  = settings.connectorColor;

      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        
        if (changes.isEnabled) {
          this.isEnabled = changes.isEnabled.newValue;
          if (this.isEnabled) {
            this.startEngine();
          } else {
            this.stopEngine();
          }
        }

        if (changes.selectedLevel)  {
          this.selectedLevelValue = LEVEL_MAP[changes.selectedLevel.newValue] || 1;
          this.clearOverlay();
        }
        if (changes.labelColor)     this.labelColor      = changes.labelColor.newValue;
        if (changes.labelFontSize)  this.labelFontSize   = changes.labelFontSize.newValue;
        if (changes.labelFontFamily) this.labelFontFamily = changes.labelFontFamily.newValue;
        if (changes.connectorColor) this.connectorColor  = changes.connectorColor.newValue;
        this.applyAppearanceVars();
      });

      this.detectPlatform();
      
      if (this.isEnabled) {
        this.startEngine();
      }
      
      this.setupObservers();

    } catch (e) {
      console.error("ST: Failed to initialize", e);
    }
  }

  /**
   * Detect the correct adapter for the current platform.
   */
  detectPlatform() {
    this.activeAdapter = this.adapters.find(a => a.isMatch()) || this.adapters[this.adapters.length - 1];
    console.log(`ST: Detected platform adapter: ${this.activeAdapter.name}`);
  }

  /**
   * Main engine loop to detect video and subtitles.
   */
  startEngine() {
    if (this.checkReadyInterval) return;
    
    console.log('ST: Starting engine...');
    this.checkReadyInterval = setInterval(() => {
      if (!this.isEnabled) {
        this.stopEngine();
        return;
      }

      const container = this.activeAdapter.getSubtitleContainer();
      const video = findElementRecursive(document.body, 'video'); // Use recursive helper
      
      if (container && video && this.isDictionaryLoaded) {
        clearInterval(this.checkReadyInterval);
        this.checkReadyInterval = null;
        this.setupOverlay(video);
        this.setupSubtitleObserver(container);
        this.processNode(container);
        this.startSentinel();
      }
    }, 1000);
  }

  /**
   * Stop engine logic, disconnect observer and clear overlay.
   */
  stopEngine() {
    console.log('ST: Stopping engine...');
    if (this.checkReadyInterval) {
      clearInterval(this.checkReadyInterval);
      this.checkReadyInterval = null;
    }
    if (this.sentinelInterval) {
      clearInterval(this.sentinelInterval);
      this.sentinelInterval = null;
    }
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.clearOverlay();
    this.observedNode = null;
  }

  /**
   * Set up observers for navigation (SPA) and fullscreen.
   */
  setupObservers() {
    // 1. SPA Navigation Tracking (URL Observer)
    let lastUrl = window.location.href;
    const urlObserver = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        console.log('ST: URL changed — re-detecting platform and engine.');
        this.reset();
      }
    });
    urlObserver.observe(document, { subtree: true, childList: true });

    // 2. Fullscreen Support
    document.addEventListener('fullscreenchange', () => {
      console.log('ST: Fullscreen changed — verifying overlay.');
      setTimeout(() => {
        const video = findElementRecursive(document.body, 'video');
        if (video) this.setupOverlay(video);
      }, 500);
    });
  }

  /**
   * Reset the engine state.
   */
  reset() {
    if (this.observer) this.observer.disconnect();
    this.clearOverlay();
    this.detectPlatform();
    this.startEngine();
  }

  /**
   * Create and attach the translation overlay.
   */
  setupOverlay(video) {
    if (document.getElementById('nwt-overlay')) {
      const existing = document.getElementById('nwt-overlay');
      const targetContainer = this.activeAdapter.getVideoContainer() || video.parentElement;
      if (existing.parentElement !== targetContainer) {
        targetContainer.appendChild(existing);
      }
      return;
    }

    this.overlay = document.createElement('div');
    this.overlay.id = 'nwt-overlay';

    const container = this.activeAdapter.getVideoContainer() || video.parentElement;
    if (container) {
      container.style.position = container.style.position || 'relative';
      container.appendChild(this.overlay);
      this.applyAppearanceVars();
    }
  }

  applyAppearanceVars() {
    if (!this.overlay) return;
    this.overlay.style.setProperty('--nwt-color',       this.labelColor);
    this.overlay.style.setProperty('--nwt-font-size',   `${this.labelFontSize}px`);
    this.overlay.style.setProperty('--nwt-font-family', this.labelFontFamily);
    this.overlay.style.setProperty('--nwt-connector-color', this.connectorColor);
  }

  setupSubtitleObserver(container) {
    this.observedNode = container;
    let updateTimeout = null;

    this.observer = new MutationObserver((mutations) => {
      const nodesToProcess = new Set();
      let shouldClear = false;

      mutations.forEach((mutation) => {
        // Guard: ignore mutations originating from our own overlay
        if (mutation.target.id === 'nwt-overlay' || (mutation.target.closest && mutation.target.closest('#nwt-overlay'))) return;
        if (mutation.type === 'childList' && Array.from(mutation.addedNodes).some(n => n.id === 'nwt-overlay' || (n.classList && n.classList.contains('nwt-translation')))) return;

        const nodes = this.activeAdapter.getNodesToProcess(mutation);
        nodes.forEach(n => nodesToProcess.add(n));
        
        if (this.activeAdapter.isCleared(container)) {
          shouldClear = true;
        }
      });

      if (nodesToProcess.size > 0 || shouldClear) {
        // Debounce: Cancel pending updates to only process the last one in the batch
        if (updateTimeout) cancelAnimationFrame(updateTimeout);
        
        updateTimeout = requestAnimationFrame(() => {
          this.clearOverlay();
          if (!shouldClear) {
            nodesToProcess.forEach(node => this.processNode(node));
          }
          updateTimeout = null;
        });
      }
    });

    this.observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  startSentinel() {
    if (this.sentinelInterval) clearInterval(this.sentinelInterval);
    
    this.sentinelInterval = setInterval(() => {
      // Use isConnected instead of document.contains()
      // isConnected works across Shadow DOM boundaries.
      if (this.observedNode && !this.observedNode.isConnected) {
        console.log('ST: Subtitle node detached — re-initializing.');
        this.reset();
      }
    }, 3000);
  }

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

  resolveTranslation(entry, isQuestion, posRatio) {
    if (isQuestion && entry.translation_question) return entry.translation_question;
    if (posRatio <= 0.20 && entry.translation_start) return entry.translation_start;
    if (posRatio >= 0.80 && entry.translation_end)   return entry.translation_end;
    return entry.translation;
  }

  checkAndTranslateText(textNode) {
    const originalText = textNode.textContent;
    if (!originalText || originalText.trim().length < 3) return;

    const isQuestion = originalText.trim().endsWith('?');
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

    const wordTokens = tokens.filter(t => t.isWord);
    const totalWords = wordTokens.length;
    const covered = new Set();

    for (let wi = 0; wi < wordTokens.length; wi++) {
      if (covered.has(wi)) continue;

      const posRatio = totalWords <= 1 ? 0.5 : wi / (totalWords - 1);
      const maxLen = Math.min(8, wordTokens.length - wi);

      let matched = false;
      for (let len = maxLen; len >= 2; len--) {
        const firstToken = wordTokens[wi];
        const lastToken  = wordTokens[wi + len - 1];
        const candidate  = originalText.slice(firstToken.start, lastToken.end).toLowerCase()
          .replace(/['']/g, "'");

        const entry = DICTIONARY.get(candidate);
        if (entry) {
          const lvl = LEVEL_MAP[entry.level] || 6;
          if (lvl >= this.selectedLevelValue) {
            const translation = this.resolveTranslation(entry, isQuestion, posRatio);
            const isStructural = Array.isArray(entry.tags) &&
              (entry.tags.includes('connector') || entry.tags.includes('auxiliary'));
            this.injectTranslation(textNode, firstToken.start, lastToken.end, translation, isStructural);
          }
          for (let k = wi; k < wi + len; k++) covered.add(k);
          wi += len - 1;
          matched = true;
          break;
        }
      }

      if (matched) continue;

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

  injectTranslation(textNode, startOffset, endOffset, translation, isConnector = false) {
    if (!this.overlay) return;

    try {
      const range = document.createRange();
      range.setStart(textNode, startOffset);
      range.setEnd(textNode, endOffset);
      
      const rect = range.getBoundingClientRect();
      const overlayRect = this.overlay.getBoundingClientRect();

      if (overlayRect.width === 0) return;

      const left = rect.left - overlayRect.left + (rect.width / 2);
      
      // Generic line detection (simple heuristic)
      let isSecondLine = false;
      const windowHeight = window.innerHeight;
      if (rect.top > windowHeight * 0.8) {
        isSecondLine = true;
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

  clearOverlay() {
    if (this.overlay) {
      this.overlay.innerHTML = '';
    }
  }
}

new SubtitleTranslator();
