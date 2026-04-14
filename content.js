/**
 * Netflix Word Translator Content Script
 * 
 * Architectural Pattern: Non-invasive Overlay.
 */

let DICTIONARY = new Map();

class NetflixTranslator {
  constructor() {
    this.overlay = null;
    this.observer = null;
    this.isDictionaryLoaded = false;
    this.init();
  }

  /**
   * Initialize the dictionary, overlay, and observer.
   */
  async init() {
    try {
      const url = chrome.runtime.getURL('dictionary.json');
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP status ${response.status}`);
      const data = await response.json();
      DICTIONARY = new Map(Object.entries(data));
      this.isDictionaryLoaded = true;
    } catch (e) {
      console.error("NWT: Failed to load dictionary", e);
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
      
      if (DICTIONARY.has(normalized)) {
        this.injectTranslation(textNode, match.index, match.index + word.length, DICTIONARY.get(normalized));
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

      const left = rect.left - overlayRect.left + (rect.width / 2);
      
      // Determine if the word is in the first or second line
      const subtitleContainer = textNode.parentElement.closest('.player-timedtext-text-container');
      let isSecondLine = false;
      
      if (subtitleContainer) {
        const containerRect = subtitleContainer.getBoundingClientRect();
        // If the word's top is more than 40% down the container, it's likely a second line
        if ((rect.top - containerRect.top) > (containerRect.height * 0.4)) {
          isSecondLine = true;
        }
      }

      const label = document.createElement('span');
      label.className = 'nwt-translation';
      label.textContent = translation;
      label.style.left = `${left}px`;

      if (isSecondLine) {
        // Position BELOW the word for second lines
        label.style.top = `${rect.bottom - overlayRect.top}px`;
        label.style.transform = `translate(-50%, 15%)`;
      } else {
        // Position ABOVE the word for first lines
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
