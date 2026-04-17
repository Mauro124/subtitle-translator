/**
 * Netflix Platform Adapter
 */
class NetflixAdapter extends BaseAdapter {
  constructor() {
    super();
    this.name = 'Netflix';
  }

  isMatch() {
    return window.location.host.includes('netflix.com');
  }

  getSubtitleContainer() {
    return document.querySelector('.player-timedtext') || 
           document.querySelector('.watch-video--timed-text-container');
  }

  getVideoContainer() {
    // Current implementation: uses parent of the video tag
    const video = document.querySelector('video');
    return video ? video.parentElement : null;
  }
}
