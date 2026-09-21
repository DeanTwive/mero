/* ==========================================================================
   Mero Feed Controller
   Category Filter Chips, Responsive Video Cards, Shimmer Skeletons & Empty States
   ========================================================================== */

class MeroFeedController {
  constructor() {
    this.container = null;
    this.chipsContainer = null;
    this.activeCategory = "All";
    this.searchQuery = "";
    this.isLoading = false;
  }

  init() {
    this.container = document.getElementById("videoGrid");
    this.chipsContainer = document.getElementById("categoryChips");
    this.renderCategoryChips();
  }

  renderCategoryChips() {
    if (!this.chipsContainer) return;
    this.chipsContainer.innerHTML = "";

    MERO_CATEGORIES.forEach(cat => {
      const btn = document.createElement("button");
      btn.className = `chip-btn ${cat === this.activeCategory ? "active" : ""}`;
      btn.textContent = cat;
      btn.addEventListener("click", () => {
        this.activeCategory = cat;
        this.updateActiveChipUI();
        this.renderFeed();
      });
      this.chipsContainer.appendChild(btn);
    });
  }

  updateActiveChipUI() {
    if (!this.chipsContainer) return;
    const chips = this.chipsContainer.querySelectorAll(".chip-btn");
    chips.forEach(chip => {
      chip.classList.toggle("active", chip.textContent === this.activeCategory);
    });
  }

  setSearchQuery(query) {
    this.searchQuery = (query || "").trim().toLowerCase();
    this.renderFeed();
  }

  // --- Render Skeletons (Loading State) ---
  showSkeletons(count = 8) {
    if (!this.container) return;
    this.isLoading = true;
    let skeletonHtml = "";
    for (let i = 0; i < count; i++) {
      skeletonHtml += `
        <div class="skeleton-card">
          <div class="skeleton-thumb shimmer"></div>
          <div class="skeleton-body">
            <div class="skeleton-avatar shimmer"></div>
            <div class="skeleton-lines">
              <div class="skeleton-line w-full shimmer"></div>
              <div class="skeleton-line w-80 shimmer"></div>
              <div class="skeleton-line w-50 shimmer"></div>
            </div>
          </div>
        </div>
      `;
    }
    this.container.innerHTML = skeletonHtml;
  }

  // --- Render Video Cards ---
  renderFeed(customVideoList = null) {
    if (!this.container) return;

    let list = customVideoList || MERO_VIDEOS;

    // Filter by category
    if (!customVideoList && this.activeCategory !== "All") {
      list = list.filter(v => v.category.toLowerCase() === this.activeCategory.toLowerCase());
    }

    // Filter by search query
    if (this.searchQuery) {
      list = list.filter(v => {
        const matchTitle = v.title.toLowerCase().includes(this.searchQuery);
        const matchCreator = v.channel.name.toLowerCase().includes(this.searchQuery);
        const matchCategory = v.category.toLowerCase().includes(this.searchQuery);
        const matchDesc = v.description.toLowerCase().includes(this.searchQuery);
        return matchTitle || matchCreator || matchCategory || matchDesc;
      });
    }

    if (list.length === 0) {
      this.renderEmptyState();
      return;
    }

    this.container.innerHTML = "";
    list.forEach(video => {
      const card = this.createVideoCard(video);
      this.container.appendChild(card);
    });
  }

  createVideoCard(video) {
    const isSaved = window.meroStore.isWatchLater(video.id);
    const isPlaying = window.meroPlayer?.currentVideo?.id === video.id;

    const card = document.createElement("article");
    card.className = `video-card ${isPlaying ? "is-active-playing" : ""}`;
    card.dataset.id = video.id;

    card.innerHTML = `
      <div class="card-thumbnail-wrap">
        <img class="card-thumbnail-img" src="${video.thumbnail}" alt="${video.title}" loading="lazy" />
        <span class="category-badge">${video.category}</span>
        <span class="duration-badge">${video.durationFormatted}</span>
        <div class="card-quick-actions">
          <button class="card-quick-btn ${isSaved ? "saved" : ""}" data-action="save" title="Watch Later" aria-label="Save to Watch Later">
            <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </button>
          <button class="card-quick-btn" data-action="share" title="Share" aria-label="Share video">
            <svg class="icon" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
          </button>
        </div>
      </div>
      <div class="card-info-wrap">
        <div class="card-author-avatar">
          <img src="${video.channel.avatar}" alt="${video.channel.name}" loading="lazy" />
        </div>
        <div class="card-details">
          <h3 class="card-title line-clamp-2">${video.title}</h3>
          <div class="card-creator-row">
            <span>${video.channel.name}</span>
            ${video.channel.verified ? `
              <svg class="verified-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path></svg>
            ` : ""}
          </div>
          <div class="card-meta-row">
            <span>${video.views}</span>
            <span class="meta-dot"></span>
            <span>${video.uploadedAt}</span>
          </div>
        </div>
      </div>
    `;

    // Click card to play video
    card.addEventListener("click", (e) => {
      const saveBtn = e.target.closest("[data-action='save']");
      const shareBtn = e.target.closest("[data-action='share']");

      if (saveBtn) {
        e.stopPropagation();
        const saved = window.meroStore.toggleWatchLater(video.id);
        saveBtn.classList.toggle("saved", saved);
        window.showToast(saved ? "Added to Watch Later" : "Removed from Watch Later");
        return;
      }

      if (shareBtn) {
        e.stopPropagation();
        navigator.clipboard?.writeText(window.location.href);
        window.showToast("Video link copied to clipboard!");
        return;
      }

      // Open Watch Page
      window.meroApp.openWatchPage(video.id);
    });

    return card;
  }

  // --- Load Real Videos from Firestore ---
  async loadFeedFromDatabase() {
    this.showSkeletons(4);
    try {
      if (typeof window.fetchMeroVideos === "function") {
        await window.fetchMeroVideos();
      }
    } catch (e) {
      console.warn("Could not fetch videos from Firestore:", e);
    } finally {
      this.isLoading = false;
      this.renderFeed();
    }
  }

  // --- Empty State View ---
  renderEmptyState() {
    // If no videos exist at all on the platform
    if (!this.searchQuery && (!window.MERO_VIDEOS || window.MERO_VIDEOS.length === 0)) {
      this.container.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-state-icon" style="background: rgba(99,102,241,0.15); color: var(--color-primary);">
            <svg class="icon" style="width: 34px; height: 34px;" viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
          </div>
          <h3 class="empty-state-title">No videos uploaded yet</h3>
          <p class="empty-state-text">
            Be the first creator to publish content on Mero! Sign in and upload your first video.
          </p>
          <button class="btn-empty-action" id="emptyUploadFirstVideoBtn">
            <svg class="icon" style="width: 18px; height: 18px; stroke: #fff;" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>Upload First Video</span>
          </button>
        </div>
      `;

      const uploadBtn = document.getElementById("emptyUploadFirstVideoBtn");
      if (uploadBtn) {
        uploadBtn.addEventListener("click", () => {
          window.meroUpload?.handleUploadTrigger();
        });
      }
      return;
    }

    // If empty due to search query or category filter
    this.container.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-state-icon">
          <svg class="icon" style="width: 32px; height: 32px;" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
        </div>
        <h3 class="empty-state-title">No matching content found</h3>
        <p class="empty-state-text">
          ${this.searchQuery ? `We couldn't find anything matching "<strong>${this.searchQuery}</strong>".` : "There are currently no videos in this category."}
        </p>
        <button class="btn-empty-action" id="resetFeedFilterBtn">Reset Filters</button>
      </div>
    `;

    const resetBtn = document.getElementById("resetFeedFilterBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        this.activeCategory = "All";
        this.searchQuery = "";
        const searchInput = document.getElementById("searchInput");
        if (searchInput) searchInput.value = "";
        this.updateActiveChipUI();
        this.renderFeed();
      });
    }
  }
}

window.meroFeed = new MeroFeedController();

