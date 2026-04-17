/**
 * Base Platform Adapter
 * All specific adapters (Netflix, YouTube, etc.) should extend this.
 */
class BaseAdapter {
  constructor() {
    this.name = 'Base';
  }

  /**
   * Detect if the current page matches this platform.
   * @returns {boolean}
   */
  isMatch() {
    return false;
  }

  /**
   * Find the primary subtitle container.
   * @returns {Element|null}
   */
  getSubtitleContainer() {
    return null;
  }

  /**
   * Find the video element or its immediate parent container for overlay injection.
   * @returns {Element|null}
   */
  getVideoContainer() {
    const video = document.querySelector('video');
    return video ? video.parentElement : null;
  }

  /**
   * Strategy to determine if a node represents a text change.
   * Default handles childList and characterData.
   * @param {MutationRecord} mutation 
   * @returns {Node[]} - Nodes to process
   */
  getNodesToProcess(mutation) {
    if (mutation.type === 'childList') {
      return Array.from(mutation.addedNodes);
    } else if (mutation.type === 'characterData') {
      return [mutation.target];
    }
    return [];
  }

  /**
   * Check if subtitles are currently empty/cleared.
   * @param {Element} container 
   * @returns {boolean}
   */
  isCleared(container) {
    // Filter out our own overlay from the check
    const hasOriginalContent = Array.from(container.childNodes).some(n => {
      if (n.id === 'nwt-overlay') return false;
      if (n.nodeType === Node.TEXT_NODE) return n.textContent.trim().length > 0;
      return n.innerText && n.innerText.trim().length > 0;
    });
    return !hasOriginalContent;
  }
}
