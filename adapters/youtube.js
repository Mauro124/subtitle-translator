/**
 * YouTube Platform Adapter
 */
class YouTubeAdapter extends BaseAdapter {
  constructor() {
    super();
    this.name = 'YouTube';
  }

  isMatch() {
    return window.location.host.includes('youtube.com');
  }

  getSubtitleContainer() {
    // YouTube uses multiple caption windows, container is the common parent
    return document.querySelector('.ytp-caption-window-container');
  }

  getVideoContainer() {
    // YouTube's video is inside .html5-video-container
    const video = document.querySelector('video');
    return video ? (video.closest('.html5-video-container') || video.parentElement) : null;
  }
}
