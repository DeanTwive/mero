/* ==========================================================================
   Mero Master Application Controller
   Navigation Router, View Transitions, Global Shortcuts, & Modals
   ========================================================================== */

// Global Toast Notification Helper
window.showToast = function(message) {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `
    <svg class="icon" style="width: 18px; height: 18px; stroke: var(--color-accent);" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3800);
};

// Global Fallback Handlers for Modals
// Defined early (before ES modules load) so inline onclick handlers always work.
// auth.js & upload.js will override these with the real implementations.
window.openAuthModal = function(reason, callback) {
  const modal = document.getElementById("authModal");
  if (!modal) return;
  const reasonEl = document.getElementById("authModalReason");
  if (reasonEl && reason) reasonEl.textContent = reason;
  modal.classList.add("active");
  document.body.classList.add("modal-open");
  // Store callback for when auth.js picks it up
  window._pendingAuthCallback = callback || null;
};

window.closeAuthModal = function() {
  const modal = document.getElementById("authModal");
  if (modal) {
    modal.classList.remove("active");
    document.body.classList.remove("modal-open");
  }
};

// Called by ALL upload buttons. Delegates to the auth-aware handler.
window.openUploadModal = function() {
  if (window.meroUpload && typeof window.meroUpload.handleUploadTrigger === "function") {
    window.meroUpload.handleUploadTrigger();
    return;
  }
  // meroUpload not ready yet — open auth modal as the safe fallback
  if (window.meroAuth && window.meroAuth.currentUser) {
    const modal = document.getElementById("uploadModal");
    if (modal) {
      modal.classList.add("active");
      document.body.classList.add("modal-open");
    }
  } else {
    window.openAuthModal("Sign in to upload and share your videos on Mero.");
  }
};

window.closeUploadModal = function() {
  if (window.meroUpload && typeof window.meroUpload.closeModal === "function") {
    window.meroUpload.closeModal();
    return;
  }
  const modal = document.getElementById("uploadModal");
  if (modal) {
    modal.classList.remove("active");
    document.body.classList.remove("modal-open");
  }
};

class MeroApp {
  constructor() {
    this.currentView = "home";
    this.previousView = "home";
    this.activeVideo = null;
  }

  init() {
    // Initialize sub-controllers
    window.meroPlayer.init();
    window.meroFeed.init();
    window.meroDrawer.init();

    this.bindNavigation();
    this.bindSearch();
    this.bindKeyboardShortcuts();
    this.bindSleepTimerModal();
    this.renderSidebarSubscriptions();

    // Initial feed render from real database
    window.meroFeed.loadFeedFromDatabase();

    // State change listener
    window.addEventListener("mero:state-change", () => {
      this.renderSidebarSubscriptions();
      if (this.currentView === "library" || this.currentView === "subscriptions") {
        this.handleRouteContent(this.currentView);
      }
    });

    // Watch later event listener
    window.addEventListener("mero:watchlater", () => {
      if (this.currentView === "library") {
        this.handleRouteContent("library");
      }
    });
  }

  // --- Router & Navigation ---
  bindNavigation() {
    // Bottom Nav (Mobile) & Sidebar (Desktop)
    const navItems = document.querySelectorAll("[data-nav]");
    navItems.forEach(item => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const route = item.dataset.nav;
        this.navigateTo(route);
      });
    });

    // Brand logo click returns home
    const brandBtn = document.getElementById("brandLogoBtn");
    if (brandBtn) {
      brandBtn.addEventListener("click", () => this.navigateTo("home"));
    }

    // Video Player Back Button (Returns user to previous feed or home)
    const playerBackBtn = document.getElementById("playerBackBtn");
    if (playerBackBtn) {
      playerBackBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.navigateBack();
      });
    }
  }

  navigateBack() {
    const target = (this.previousView && this.previousView !== "watch") ? this.previousView : "home";
    this.navigateTo(target);
  }

  navigateTo(route) {
    this.currentView = route;

    // Update active indicators
    document.querySelectorAll("[data-nav]").forEach(el => {
      el.classList.toggle("active", el.dataset.nav === route);
    });

    const feedSection = document.getElementById("feedSection");
    const watchSection = document.getElementById("watchSection");
    const feedFilterBar = document.getElementById("feedFilterBar") || document.getElementById("categoryChips");

    // Close drawers when navigating
    window.meroDrawer?.closeDrawer();
    window.meroFeed?.closeTagsDrawer();

    if (route === "watch") {
      if (feedSection) feedSection.style.display = "none";
      if (watchSection) watchSection.style.display = "block";
      if (feedFilterBar) feedFilterBar.style.display = "none";
      window.meroPlayer.hideMiniPlayer();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      if (feedSection) feedSection.style.display = "block";
      if (watchSection) watchSection.style.display = "none";
      if (feedFilterBar) feedFilterBar.style.display = "flex";

      // If a video is playing, show the floating mini-player!
      if (window.meroPlayer.currentVideo && !window.meroPlayer.videoEl?.paused) {
        window.meroPlayer.showMiniPlayer();
      }

      this.handleRouteContent(route);
    }
  }

  handleRouteContent(route) {
    const user = window.meroAuth?.currentUser;

    if (route === "home") {
      window.meroFeed.activeCategory = "All";
      window.meroFeed.updateActiveChipUI();
      window.meroFeed.renderFeed();
    } else if (route === "explore") {
      // Sort by views desc
      const sorted = [...(window.MERO_VIDEOS || [])].sort((a, b) => {
        const getV = str => parseFloat(str) * (str.includes("M") ? 1000000 : 1000);
        return getV(b.views) - getV(a.views);
      });
      window.meroFeed.renderFeed(sorted);
      window.showToast("Showing Trending & Popular Videos");
    } else if (route === "subscriptions") {
      // AUTH GATE: User must be signed in to see subscriptions
      if (!user) {
        const grid = document.getElementById("videoGrid");
        if (grid) {
          grid.innerHTML = `
            <div class="empty-state-card auth-gate-card">
              <div class="empty-state-icon" style="background: rgba(99,102,241,0.16); color: var(--color-primary);">
                <svg class="icon" style="width: 38px; height: 38px;" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
              </div>
              <h2 class="empty-state-title">Sign in to see your Subscriptions</h2>
              <p class="empty-state-text">
                Don't miss new videos from creators you follow. Sign in to access your channel subscriptions feed.
              </p>
              <button class="btn-empty-action" id="subsGateSignInBtn" onclick="window.openAuthModal ? window.openAuthModal('Sign in to access your channel subscriptions.') : window.meroAuth?.openAuthModal('Sign in to access your channel subscriptions.')">
                <svg class="icon" style="width: 18px; height: 18px; stroke: #fff;" viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
                <span>Sign In to Access</span>
              </button>
            </div>
          `;
          document.getElementById("subsGateSignInBtn")?.addEventListener("click", () => {
            if (typeof window.openAuthModal === "function") {
              window.openAuthModal("Sign in to access your channel subscriptions.");
            } else if (window.meroAuth?.openAuthModal) {
              window.meroAuth.openAuthModal("Sign in to access your channel subscriptions.");
            }
          });
        }
        return;
      }

      // Logged in: show real subscribed videos
      const subs = window.meroStore.state.subscriptions;
      const subVideos = (window.MERO_VIDEOS || []).filter(v => subs.includes(v.channel.id));
      if (subVideos.length === 0) {
        const grid = document.getElementById("videoGrid");
        if (grid) {
          grid.innerHTML = `
            <div class="empty-state-card">
              <div class="empty-state-icon">
                <svg class="icon" style="width: 32px; height: 32px;" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              </div>
              <h3 class="empty-state-title">No subscriptions yet</h3>
              <p class="empty-state-text">Subscribe to creators you like on their video watch pages to see their latest uploads here.</p>
              <button class="btn-empty-action" onclick="window.meroApp.navigateTo('home')">Browse Videos</button>
            </div>
          `;
        }
      } else {
        window.meroFeed.renderFeed(subVideos);
      }
    } else if (route === "library") {
      // AUTH GATE: User must be signed in to see Watch Later
      if (!user) {
        const grid = document.getElementById("videoGrid");
        if (grid) {
          grid.innerHTML = `
            <div class="empty-state-card auth-gate-card">
              <div class="empty-state-icon" style="background: rgba(6,182,212,0.16); color: var(--color-accent);">
                <svg class="icon" style="width: 38px; height: 38px;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </div>
              <h2 class="empty-state-title">Sign in to view Watch Later</h2>
              <p class="empty-state-text">
                Save videos from any device and watch them whenever you're ready. Sign in to view your personalized Watch Later list.
              </p>
              <button class="btn-empty-action" id="libraryGateSignInBtn" onclick="window.openAuthModal ? window.openAuthModal('Sign in to access your Watch Later playlist.') : window.meroAuth?.openAuthModal('Sign in to access your Watch Later playlist.')">
                <svg class="icon" style="width: 18px; height: 18px; stroke: #fff;" viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
                <span>Sign In to Access Playlist</span>
              </button>
            </div>
          `;
          document.getElementById("libraryGateSignInBtn")?.addEventListener("click", () => {
            if (typeof window.openAuthModal === "function") {
              window.openAuthModal("Sign in to access your Watch Later playlist.");
            } else if (window.meroAuth?.openAuthModal) {
              window.meroAuth.openAuthModal("Sign in to access your Watch Later playlist.");
            }
          });
        }
        return;
      }

      // Ensure store is aligned with current authenticated user
      if (window.meroStore && user && window.meroStore.currentUid !== user.uid) {
        window.meroStore.setUser(user);
      }

      // Logged in: show real saved videos for current authenticated user
      const savedIds = Array.isArray(window.meroStore?.state?.watchLater) ? window.meroStore.state.watchLater : [];
      const savedVideos = (window.MERO_VIDEOS || []).filter(v => savedIds.includes(v.id));
      if (savedVideos.length === 0) {
        const grid = document.getElementById("videoGrid");
        if (grid) {
          grid.innerHTML = `
            <div class="empty-state-card">
              <div class="empty-state-icon">
                <svg class="icon" style="width: 32px; height: 32px;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </div>
              <h3 class="empty-state-title">Your Watch Later playlist is empty</h3>
              <p class="empty-state-text">Tap the clock icon on any video card or watch page to save it for later.</p>
              <button class="btn-empty-action" onclick="window.meroApp.navigateTo('home')">Explore Feed</button>
            </div>
          `;
        }
      } else {
        window.meroFeed.renderFeed(savedVideos);
      }
    }
  }

  // --- Open Watch Page ---
  openWatchPage(videoId, autoPlay = true) {
    const list = window.MERO_VIDEOS || [];
    const video = list.find(v => v.id === videoId) || list[0];
    if (!video) {
      window.showToast("No videos available.");
      return;
    }
    if (this.currentView && this.currentView !== "watch") {
      this.previousView = this.currentView;
    }
    this.activeVideo = video;

    this.navigateTo("watch");
    window.meroPlayer.loadVideo(video, autoPlay);
    window.meroDrawer.setVideo(video);

    // Update watch page metadata
    this.updateWatchMetadataUI(video);
  }

  updateWatchMetadataUI(video) {
    if (!video) return;
    // Title
    const titleEl = document.getElementById("watchVideoTitle");
    if (titleEl) titleEl.textContent = video.title;

    // Tags
    const tagsContainer = document.getElementById("watchVideoTags");
    if (tagsContainer) {
      tagsContainer.innerHTML = "";
      const rawTags = Array.isArray(video.tags) ? video.tags : [];
      const cleanTags = rawTags.map(t => String(t).replace(/^#+/, "").trim()).filter(Boolean);

      if (cleanTags.length > 0) {
        cleanTags.forEach(tag => {
          const btn = document.createElement("button");
          btn.className = "video-tag-pill";
          btn.type = "button";
          btn.textContent = `#${tag}`;
          btn.title = `Search videos tagged with #${tag}`;
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.searchByTag(tag);
          });
          tagsContainer.appendChild(btn);
        });
        tagsContainer.style.display = "flex";
      } else {
        tagsContainer.style.display = "none";
      }
    }

    // Creator profile
    const avatarEl = document.getElementById("watchCreatorAvatar");
    const nameEl = document.getElementById("watchCreatorName");
    const subsEl = document.getElementById("watchSubscriberCount");
    const subBtn = document.getElementById("watchSubscribeBtn");

    if (avatarEl) avatarEl.src = video.channel.avatar;
    if (nameEl) nameEl.textContent = video.channel.name;
    if (subsEl) subsEl.textContent = video.channel.subscribers;

    // Subscribe button state
    const isSubscribed = window.meroStore.isSubscribed(video.channel.id);
    if (subBtn) {
      this.syncSubscribeBtnUI(subBtn, isSubscribed);
      subBtn.onclick = () => {
        const nowSub = window.meroStore.toggleSubscribe(video.channel.id);
        this.syncSubscribeBtnUI(subBtn, nowSub);
        window.showToast(nowSub ? `Subscribed to ${video.channel.name}` : `Unsubscribed from ${video.channel.name}`);
      };
    }

    // Like button
    const likeBtn = document.getElementById("watchLikeBtn");
    const isLiked = window.meroStore.isLiked(video.id);
    if (likeBtn) {
      likeBtn.classList.toggle("liked", isLiked);
      likeBtn.onclick = () => {
        const nowLiked = window.meroStore.toggleLike(video.id);
        likeBtn.classList.toggle("liked", nowLiked);
        window.showToast(nowLiked ? "Added to Liked Videos" : "Removed from Liked Videos");
      };
    }

    // Save to Watch Later buttons (Action Bar Pill + Player Overlay Quick Button)
    const saveBtn = document.getElementById("watchSaveBtn");
    const playerQuickSaveBtn = document.getElementById("playerQuickSaveBtn");
    const isSaved = window.meroStore.isWatchLater(video.id);

    const updateSaveUI = (saved) => {
      if (saveBtn) {
        saveBtn.classList.toggle("active", saved);
        const label = saveBtn.querySelector("span");
        if (label) label.textContent = saved ? "Saved" : "Save";
        const icon = saveBtn.querySelector(".icon");
        if (icon) {
          icon.innerHTML = saved
            ? `<path d="M20 6L9 17l-5-5"></path>`
            : `<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>`;
        }
      }
      if (playerQuickSaveBtn) {
        playerQuickSaveBtn.classList.toggle("active", saved);
        playerQuickSaveBtn.setAttribute("title", saved ? "Saved to Watch Later (Click to remove)" : "Save to Watch Later");
        playerQuickSaveBtn.setAttribute("aria-label", saved ? "Saved to Watch Later" : "Save to Watch Later");
        const qIcon = playerQuickSaveBtn.querySelector(".icon");
        if (qIcon) {
          qIcon.innerHTML = saved
            ? `<polyline points="20 6 9 17 4 12" stroke-width="2.5"></polyline>`
            : `<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>`;
        }
      }
    };

    const handleToggleSave = (e) => {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }
      const nowSaved = window.meroStore.toggleWatchLater(video.id);
      updateSaveUI(nowSaved);
      window.showToast(nowSaved ? "Saved to Watch Later" : "Removed from Watch Later");
    };

    if (saveBtn) saveBtn.onclick = handleToggleSave;
    if (playerQuickSaveBtn) playerQuickSaveBtn.onclick = handleToggleSave;
    updateSaveUI(isSaved);

    // Share button
    const shareBtn = document.getElementById("watchShareBtn");
    if (shareBtn) {
      shareBtn.onclick = () => {
        navigator.clipboard?.writeText(window.location.href);
        window.showToast("Video link copied to clipboard!");
      };
    }

    // Mobile Drawer Triggers (Comments & Chapters Buttons on mobile)
    const mobileChaptersBtn = document.getElementById("mobileOpenChaptersBtn");
    const mobileCommentsBtn = document.getElementById("mobileOpenCommentsBtn");
    if (mobileChaptersBtn) {
      mobileChaptersBtn.onclick = () => window.meroDrawer.openDrawer("chapters");
    }
    if (mobileCommentsBtn) {
      mobileCommentsBtn.onclick = () => window.meroDrawer.openDrawer("comments");
    }

    // Description text
    const descText = document.getElementById("watchDescText");
    const descViews = document.getElementById("watchDescViews");
    const descTime = document.getElementById("watchDescTime");
    const descCard = document.getElementById("watchDescCard");

    if (descText) descText.textContent = video.description;
    if (descViews) descViews.textContent = video.views;
    if (descTime) descTime.textContent = video.uploadedAt;

    if (descCard) {
      descCard.onclick = () => {
        descText?.classList.toggle("collapsed");
        const toggleBtn = document.getElementById("watchDescToggleBtn");
        if (toggleBtn) {
          toggleBtn.textContent = descText?.classList.contains("collapsed") ? "...show more" : "show less";
        }
      };
    }
  }

  syncSubscribeBtnUI(btn, isSubscribed) {
    if (isSubscribed) {
      btn.textContent = "Subscribed";
      btn.classList.add("is-subscribed");
    } else {
      btn.textContent = "Subscribe";
      btn.classList.remove("is-subscribed");
    }
  }

  // --- Search Handling ---
  bindSearch() {
    const form = document.getElementById("searchForm");
    const input = document.getElementById("searchInput");
    const clearBtn = document.getElementById("searchClearBtn");

    if (!input) return;

    let debounceTimer = null;
    input.addEventListener("input", () => {
      const val = input.value;
      if (clearBtn) clearBtn.classList.toggle("active", val.length > 0);

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (this.currentView === "watch") {
          this.navigateTo("home");
        }
        window.meroFeed.setSearchQuery(val);
      }, 200);
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        input.value = "";
        clearBtn.classList.remove("active");
        window.meroFeed.setSearchQuery("");
      });
    }

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        window.meroFeed.setSearchQuery(input.value);
      });
    }
  }

  // --- Tag-based Search & Navigation ---
  searchByTag(tag) {
    if (!tag) return;
    const clean = String(tag).replace(/^#+/, "").trim();
    if (!clean) return;

    this.navigateTo("home");

    if (window.meroFeed) {
      window.meroFeed.selectTagFilter(clean);
    }
  }

  // --- Sleep Timer Modal ---
  bindSleepTimerModal() {
    const openBtn = document.getElementById("playerSleepBtn");
    const modal = document.getElementById("sleepTimerModal");
    const cancelBtn = document.getElementById("cancelSleepModalBtn");

    if (openBtn && modal) {
      openBtn.addEventListener("click", () => modal.classList.add("active"));
    }

    if (cancelBtn && modal) {
      cancelBtn.addEventListener("click", () => modal.classList.remove("active"));
    }

    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.classList.remove("active");
      });
    }

    const options = document.querySelectorAll(".sleep-option-btn");
    options.forEach(opt => {
      opt.addEventListener("click", () => {
        const val = opt.dataset.minutes;
        if (val === "cancel") {
          window.meroPlayer.cancelSleepTimer();
          window.showToast("Sleep timer cancelled");
        } else if (val === "end") {
          window.meroPlayer.setSleepTimer("end_of_video");
        } else {
          window.meroPlayer.setSleepTimer(parseInt(val, 10));
        }
        modal.classList.remove("active");
      });
    });
  }

  // --- Keyboard Shortcuts (Pro Watcher Experience) ---
  bindKeyboardShortcuts() {
    window.addEventListener("keydown", (e) => {
      // Don't trigger if user is typing in an input
      if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          window.meroPlayer.togglePlay();
          break;
        case "j":
          e.preventDefault();
          window.meroPlayer.seekRelative(-10);
          break;
        case "l":
          e.preventDefault();
          window.meroPlayer.seekRelative(10);
          break;
        case "f":
          e.preventDefault();
          window.meroPlayer.toggleFullscreen();
          break;
        case "m":
          e.preventDefault();
          if (window.meroPlayer.videoEl) {
            window.meroPlayer.videoEl.muted = !window.meroPlayer.videoEl.muted;
            window.meroPlayer.updateVolumeUI();
          }
          break;
        case "c":
          e.preventDefault();
          const ambBtn = document.getElementById("playerAmbientBtn");
          if (ambBtn) ambBtn.click();
          break;
      }
    });
  }

  renderSidebarSubscriptions() {
    const listEl = document.getElementById("sidebarSubsList");
    if (!listEl) return;

    const subscribedIds = window.meroStore.state.subscriptions;
    const channels = [];

    (window.MERO_VIDEOS || []).forEach(v => {
      if (subscribedIds.includes(v.channel.id) && !channels.some(c => c.id === v.channel.id)) {
        channels.push(v.channel);
      }
    });

    if (channels.length === 0) {
      listEl.innerHTML = `<span style="font-size: 0.75rem; color: var(--text-dimmed); padding: 0 12px;">No subscriptions</span>`;
      return;
    }

    listEl.innerHTML = channels.map(ch => `
      <div class="sub-creator-item" style="cursor: pointer;" onclick="window.meroFeed.setSearchQuery('${ch.name}'); window.meroApp.navigateTo('home');">
        <img src="${ch.avatar}" class="sub-avatar" alt="${ch.name}" />
        <span class="line-clamp-1">${ch.name}</span>
      </div>
    `).join("");
  }
}

window.meroApp = new MeroApp();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.meroApp.init();
  });
} else {
  window.meroApp.init();
}
