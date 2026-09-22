/* ==========================================================================
   Mero Reactive Store
   Single Source of Truth, LocalStorage Persistence & Event Dispatcher
   ========================================================================== */

class MeroStore {
  constructor() {
    this.currentUid = null;
    this.state = this.getEmptyState();
    this.init();
  }

  getEmptyState() {
    return {
      subscriptions: [],
      likedVideos: [],
      dislikedVideos: [],
      watchLater: [],
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
  }

  getUserStorageKey(uid) {
    return uid ? `mero_user_state_${uid}` : null;
  }

  init() {
    // Purge legacy global state to prevent data leakage between different users
    try {
      localStorage.removeItem("mero_user_state_v1");
      localStorage.removeItem("mero_user_state_undefined");
      localStorage.removeItem("mero_user_state_null");
    } catch (e) {}

    // Listen to Firebase Auth state changes
    window.addEventListener("mero:auth-state-changed", (e) => {
      this.setUser(e.detail?.user);
    });

    // Check if user is already authenticated
    if (window.meroAuth?.currentUser) {
      this.setUser(window.meroAuth.currentUser);
    }
  }

  loadLocalUserState(uid) {
    const empty = this.getEmptyState();
    if (!uid) return empty;

    try {
      const key = this.getUserStorageKey(uid);
      const stored = key ? localStorage.getItem(key) : null;
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...empty,
          ...parsed,
          subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [],
          watchLater: Array.isArray(parsed.watchLater) ? parsed.watchLater : [],
          likedVideos: Array.isArray(parsed.likedVideos) ? parsed.likedVideos : [],
          settings: { ...empty.settings, ...(parsed.settings || {}) }
        };
      }
    } catch (e) {
      console.warn("Unable to load user state from localStorage:", e);
    }
    return empty;
  }

  async setUser(user) {
    const uid = user ? user.uid : null;
    this.currentUid = uid;

    if (!uid) {
      // Logged out / Guest: completely clean empty state
      this.state = this.getEmptyState();
      window.dispatchEvent(new CustomEvent("mero:state-change", { detail: this.state }));
      return;
    }

    // 1. Immediately load local cache for this specific user
    this.state = this.loadLocalUserState(uid);
    window.dispatchEvent(new CustomEvent("mero:state-change", { detail: this.state }));

    // 2. Asynchronously sync with Firestore user document
    try {
      if (window.meroDb?.getUserData) {
        const cloudData = await window.meroDb.getUserData(uid);
        if (cloudData && this.currentUid === uid) {
          this.state.watchLater = Array.isArray(cloudData.watchLater) ? [...cloudData.watchLater] : [];
          this.state.subscriptions = Array.isArray(cloudData.subscriptions) ? [...cloudData.subscriptions] : [];
          this.saveState();
        }
      }
    } catch (err) {
      console.warn("Could not sync user state with Firestore:", err);
    }
  }

  saveState() {
    if (!this.currentUid) return;
    try {
      const key = this.getUserStorageKey(this.currentUid);
      if (key) {
        localStorage.setItem(key, JSON.stringify(this.state));
      }
    } catch (e) {
      console.warn("Unable to save state to localStorage:", e);
    }
    window.dispatchEvent(new CustomEvent("mero:state-change", { detail: this.state }));
  }

  // --- Subscriptions (User-Scoped) ---
  isSubscribed(channelId) {
    return Array.isArray(this.state.subscriptions) && this.state.subscriptions.includes(channelId);
  }

  toggleSubscribe(channelId) {
    const user = window.meroAuth?.currentUser;
    if (!user) {
      if (typeof window.openAuthModal === "function") {
        window.openAuthModal("Sign in to subscribe to channels.");
      }
      return false;
    }

    if (!this.currentUid) this.currentUid = user.uid;
    const index = this.state.subscriptions.indexOf(channelId);
    let isNowSubscribed = false;
    if (index > -1) {
      this.state.subscriptions.splice(index, 1);
    } else {
      this.state.subscriptions.push(channelId);
      isNowSubscribed = true;
    }
    this.saveState();

    // Sync with Firestore
    if (window.meroDb?.toggleSubscription) {
      window.meroDb.toggleSubscription(this.currentUid, channelId, isNowSubscribed);
    }

    window.dispatchEvent(new CustomEvent("mero:subscribed", { 
      detail: { channelId, isSubscribed: isNowSubscribed } 
    }));
    return isNowSubscribed;
  }

  // --- Like / Dislike (User-Scoped) ---
  isLiked(videoId) {
    return Array.isArray(this.state.likedVideos) && this.state.likedVideos.includes(videoId);
  }

  toggleLike(videoId) {
    const user = window.meroAuth?.currentUser;
    if (!user) {
      if (typeof window.openAuthModal === "function") {
        window.openAuthModal("Sign in to like videos.");
      }
      return false;
    }

    if (!this.currentUid) this.currentUid = user.uid;
    const likeIdx = this.state.likedVideos.indexOf(videoId);
    let isLiked = false;
    if (likeIdx > -1) {
      this.state.likedVideos.splice(likeIdx, 1);
    } else {
      this.state.likedVideos.push(videoId);
      isLiked = true;
      const disIdx = this.state.dislikedVideos.indexOf(videoId);
      if (disIdx > -1) this.state.dislikedVideos.splice(disIdx, 1);
    }
    this.saveState();
    return isLiked;
  }

  // --- Watch Later (User-Scoped: User 1 and User 2 are completely isolated) ---
  isWatchLater(videoId) {
    return Array.isArray(this.state.watchLater) && this.state.watchLater.includes(videoId);
  }

  toggleWatchLater(videoId) {
    const user = window.meroAuth?.currentUser;
    if (!user) {
      if (typeof window.openAuthModal === "function") {
        window.openAuthModal("Sign in to save videos to your Watch Later playlist.");
      }
      return false;
    }

    if (!this.currentUid) this.currentUid = user.uid;
    const idx = this.state.watchLater.indexOf(videoId);
    let isSaved = false;
    if (idx > -1) {
      this.state.watchLater.splice(idx, 1);
    } else {
      this.state.watchLater.push(videoId);
      isSaved = true;
    }
    this.saveState();

    // Sync to Firestore 'users/{uid}' document
    if (window.meroDb?.toggleWatchLater) {
      window.meroDb.toggleWatchLater(this.currentUid, videoId, isSaved);
    }

    window.dispatchEvent(new CustomEvent("mero:watchlater", { detail: { videoId, isSaved } }));
    return isSaved;
  }

  // --- Watch History ---
  recordHistory(videoId, progressRatio = 0) {
    if (!Array.isArray(this.state.history)) this.state.history = [];
    this.state.history = this.state.history.filter(h => h.videoId !== videoId);
    this.state.history.unshift({
      videoId,
      lastWatched: Date.now(),
      progress: Math.min(Math.max(progressRatio, 0), 1)
    });
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
    const custom = (this.state.customComments && this.state.customComments[videoId]) || [];
    return [...custom, ...baseComments];
  }

  addComment(videoId, text, author = "You") {
    if (!this.state.customComments) this.state.customComments = {};
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
    return Array.isArray(this.state.likedComments) && this.state.likedComments.includes(commentId);
  }

  toggleLikeComment(commentId) {
    if (!Array.isArray(this.state.likedComments)) this.state.likedComments = [];
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
