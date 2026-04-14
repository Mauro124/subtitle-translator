/**
 * Netflix Word Translator Content Script
 * 
 * Architectural Pattern: Non-invasive Overlay.
 */

let DICTIONARY = new Map();
const LEVEL_MAP = { 'A1': 1, 'A2': 2, 'B1': 3, 'B2': 4, 'C1': 5, 'C2': 6 };

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
   * Normalize text and check against the dictionary.
   * Uses DOM Range to find the precise location of words within the text.
   * @param {Text} textNode 
   */
  checkAndTranslateText(textNode) {
    const originalText = textNode.textContent;
    if (!originalText || originalText.trim().length < 3) return;

    const wordRegex = /[a-zA-Z]{3,}/g; 
    let match;

    while ((match = wordRegex.exec(originalText)) !== null) {
      const word = match[0];
      const normalized = word.toLowerCase();
      
      const entry = DICTIONARY.get(normalized);
      if (entry) {
        const wordLevelValue = LEVEL_MAP[entry.level] || 6; // Default to C2 if missing
        
        // Only translate if word is AT or ABOVE user's proficiency threshold
        // (Beginners see A1+, Experts see only C2)
        if (wordLevelValue >= this.selectedLevelValue) {
          this.injectTranslation(textNode, match.index, match.index + word.length, entry.translation);
        }
      }
    }
  }

  /**
   * Inject a translation label into the overlay at precise word coordinates.
   * @param {Text} textNode 
   */
  injectTranslation(textNode, startOffset, endOffset, translation) {
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
      label.className = 'nwt-translation';
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
