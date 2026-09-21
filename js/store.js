/* ==========================================================================
   Mero Reactive Store
   Single Source of Truth, LocalStorage Persistence & Event Dispatcher
   ========================================================================== */

class MeroStore {
  constructor() {
    this.STORAGE_KEY = "mero_user_state_v1";
    this.state = this.loadState();
  }

  loadState() {
    const defaultState = {
      subscriptions: ["ch-devpulse"], // Default sub for good first impression
      likedVideos: ["vid-1"],
      dislikedVideos: [],
      watchLater: ["vid-3"],
      history: [],
      customComments: {},
      likedComments: [],
      settings: {
        ambientGlow: true,
        sleepTimerMinutes: null,
        playbackSpeed: 1,
        volume: 0.9,
        isMuted: false
      }
    };

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...defaultState,
          ...parsed,
          settings: { ...defaultState.settings, ...(parsed.settings || {}) }
        };
      }
    } catch (e) {
      console.warn("Unable to load state from localStorage:", e);
    }
    return defaultState;
  }

  saveState() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn("Unable to save state to localStorage:", e);
    }
    window.dispatchEvent(new CustomEvent("mero:state-change", { detail: this.state }));
  }

  // --- Subscriptions ---
  isSubscribed(channelId) {
    return this.state.subscriptions.includes(channelId);
  }

  toggleSubscribe(channelId) {
    const index = this.state.subscriptions.indexOf(channelId);
    let isNowSubscribed = false;
    if (index > -1) {
      this.state.subscriptions.splice(index, 1);
    } else {
      this.state.subscriptions.push(channelId);
      isNowSubscribed = true;
    }
    this.saveState();
    window.dispatchEvent(new CustomEvent("mero:subscribed", { 
      detail: { channelId, isSubscribed: isNowSubscribed } 
    }));
    return isNowSubscribed;
  }

  // --- Like / Dislike ---
  isLiked(videoId) {
    return this.state.likedVideos.includes(videoId);
  }

  toggleLike(videoId) {
    const likeIdx = this.state.likedVideos.indexOf(videoId);
    let isLiked = false;
    if (likeIdx > -1) {
      this.state.likedVideos.splice(likeIdx, 1);
    } else {
      this.state.likedVideos.push(videoId);
      isLiked = true;
      // Remove from dislike if liked
      const disIdx = this.state.dislikedVideos.indexOf(videoId);
      if (disIdx > -1) this.state.dislikedVideos.splice(disIdx, 1);
    }
    this.saveState();
    return isLiked;
  }

  // --- Watch Later ---
  isWatchLater(videoId) {
    return this.state.watchLater.includes(videoId);
  }

  toggleWatchLater(videoId) {
    const idx = this.state.watchLater.indexOf(videoId);
    let isSaved = false;
    if (idx > -1) {
      this.state.watchLater.splice(idx, 1);
    } else {
      this.state.watchLater.push(videoId);
      isSaved = true;
    }
    this.saveState();
    window.dispatchEvent(new CustomEvent("mero:watchlater", { detail: { videoId, isSaved } }));
    return isSaved;
  }

  // --- Watch History ---
  recordHistory(videoId, progressRatio = 0) {
    // Remove if already exists to push to front
    this.state.history = this.state.history.filter(h => h.videoId !== videoId);
    this.state.history.unshift({
      videoId,
      lastWatched: Date.now(),
      progress: Math.min(Math.max(progressRatio, 0), 1)
    });
    // Keep max 50 items
    if (this.state.history.length > 50) {
      this.state.history.pop();
    }
    this.saveState();
  }

  clearHistory() {
    this.state.history = [];
    this.saveState();
  }

  // --- Comments ---
  getVideoComments(videoId, baseComments = []) {
    const custom = this.state.customComments[videoId] || [];
    return [...custom, ...baseComments];
  }

  addComment(videoId, text, author = "You") {
    if (!this.state.customComments[videoId]) {
      this.state.customComments[videoId] = [];
    }
    const newComment = {
      id: "comment-" + Date.now(),
      author: author,
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
      time: "Just now",
      text: text.trim(),
      likes: 0,
      isLiked: false
    };
    this.state.customComments[videoId].unshift(newComment);
    this.saveState();
    return newComment;
  }

  isCommentLiked(commentId) {
    return this.state.likedComments.includes(commentId);
  }

  toggleLikeComment(commentId) {
    const idx = this.state.likedComments.indexOf(commentId);
    let isLiked = false;
    if (idx > -1) {
      this.state.likedComments.splice(idx, 1);
    } else {
      this.state.likedComments.push(commentId);
      isLiked = true;
    }
    this.saveState();
    return isLiked;
  }

  // --- Settings ---
  getSettings() {
    return this.state.settings;
  }

  updateSetting(key, val) {
    this.state.settings[key] = val;
    this.saveState();
  }
}

// Export singleton instance
window.meroStore = new MeroStore();
