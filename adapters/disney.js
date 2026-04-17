/**
 * Disney+ Platform Adapter
 * Optimized for Hive renderer (2026)
 */
class DisneyAdapter extends BaseAdapter {
  constructor() {
    super();
    this.name = 'Disney+';
  }

  isMatch() {
    return window.location.host.includes('disneyplus.com');
  }

  getSubtitleContainer() {
    // Exact selectors provided by user for Hive renderer
    return findElementRecursive(document.body, '.hive-subtitle-renderer-wrapper') || 
           findElementRecursive(document.body, '.TimedTextOverlay') ||
           findElementRecursive(document.body, '.hive-subtitle-renderer-cue');
  }

  getVideoContainer() {
    // In Disney+, the TimedTextOverlay is usually a sibling of the video container
    const video = findElementRecursive(document.body, 'video');
    // We want the parent that contains both video and overlay
    return video ? (video.closest('.video-container') || video.parentElement) : null;
  }
}
