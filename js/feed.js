/* ==========================================================================
   Mero Feed Controller
   Category Filter Chips, Responsive Video Cards, Shimmer Skeletons & Empty States
   ========================================================================== */

class MeroFeedController {
  constructor() {
    this.container = null;
    this.chipsContainer = null;
    this.activeCategory = "All";
    this.activeTag = null;
    this.searchQuery = "";
    this.isLoading = false;
    this.tagsDrawerOverlay = null;
    this.tagsDrawerSearchInput = null;
  }

  init() {
    this.container = document.getElementById("videoGrid");
    this.chipsContainer = document.getElementById("categoryChips");
    this.tagsDrawerOverlay = document.getElementById("tagsDrawerOverlay");
    this.tagsDrawerSearchInput = document.getElementById("tagsDrawerSearchInput");
    this.initTagsDrawer();
    this.renderCategoryChips();
  }

  _parseViews(views) {
    if (typeof views === "number") return views;
    if (!views) return 0;
    const str = String(views).trim().toLowerCase().replace(/,/g, "");
    const numPart = parseFloat(str) || 0;
    if (str.includes("m")) return numPart * 1000000;
    if (str.includes("k")) return numPart * 1000;
    return numPart;
  }

  _parseDuration(duration, formatted) {
    if (typeof duration === "number" && !isNaN(duration) && duration > 0) return duration;
    const str = String(duration || formatted || "").trim();
    const parts = str.split(":").map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parseFloat(str) || 0;
  }

  _getVideoTimestamp(video) {
    if (!video) return 0;
    if (video.createdAt) {
      if (typeof video.createdAt.toMillis === "function") return video.createdAt.toMillis();
      if (typeof video.createdAt.seconds === "number") return video.createdAt.seconds * 1000;
      if (typeof video.createdAt === "number") return video.createdAt;
      const parsed = Date.parse(video.createdAt);
      if (!isNaN(parsed)) return parsed;
    }
    if (typeof video.id === "string" && video.id.startsWith("vid-")) {
      const num = parseInt(video.id.replace("vid-", ""), 10);
      if (!isNaN(num)) return num;
    }
    return 0;
  }

  // --- Tags Side Drawer Management ---
  initTagsDrawer() {
    const burgerBtn = document.getElementById("tagsBurgerBtn");
    const closeBtn = document.getElementById("tagsDrawerCloseBtn");
    const backdrop = document.getElementById("tagsDrawerBackdrop");
    const searchInput = document.getElementById("tagsDrawerSearchInput");
    const searchClear = document.getElementById("tagsDrawerSearchClear");
    const clearFilterBtn = document.getElementById("tagsClearBtn");

    if (burgerBtn) {
      burgerBtn.addEventListener("click", () => this.toggleTagsDrawer());
    }
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.closeTagsDrawer());
    }
    if (backdrop) {
      backdrop.addEventListener("click", () => this.closeTagsDrawer());
    }
    if (clearFilterBtn) {
      clearFilterBtn.addEventListener("click", () => this.clearTagFilter());
    }

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        const val = e.target.value.trim();
        if (searchClear) searchClear.style.display = val ? "flex" : "none";
        this.renderTagsDrawer(val);
      });
    }

    if (searchClear && searchInput) {
      searchClear.addEventListener("click", () => {
        searchInput.value = "";
        searchClear.style.display = "none";
        this.renderTagsDrawer("");
        searchInput.focus();
      });
    }

    // Close on Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.tagsDrawerOverlay?.classList.contains("open")) {
        this.closeTagsDrawer();
      }
    });
  }

  openTagsDrawer() {
    if (!this.tagsDrawerOverlay) return;
    this.tagsDrawerOverlay.classList.add("open");
    this.tagsDrawerOverlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    this.renderTagsDrawer(this.tagsDrawerSearchInput?.value || "");

    setTimeout(() => {
      this.tagsDrawerSearchInput?.focus();
    }, 150);
  }

  closeTagsDrawer() {
    if (!this.tagsDrawerOverlay) return;
    this.tagsDrawerOverlay.classList.remove("open");
    this.tagsDrawerOverlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  toggleTagsDrawer() {
    if (this.tagsDrawerOverlay?.classList.contains("open")) {
      this.closeTagsDrawer();
    } else {
      this.openTagsDrawer();
    }
  }

  getAllTagsWithCounts() {
    const counts = new Map();
    const list = window.MERO_VIDEOS || [];

    list.forEach(v => {
      if (Array.isArray(v.tags)) {
        v.tags.forEach(t => {
          const clean = String(t).replace(/^#+/, "").trim();
          if (clean) {
            // Capitalize for clean display
            const formatted = clean.charAt(0).toUpperCase() + clean.slice(1);
            const key = formatted.toLowerCase();
            if (!counts.has(key)) {
              counts.set(key, { name: formatted, count: 0 });
            }
            counts.get(key).count += 1;
          }
        });
      }
    });

    return Array.from(counts.values());
  }

  renderTagsDrawer(filterQuery = "") {
    const listContainer = document.getElementById("tagsDrawerContent");
    const countLabel = document.getElementById("tagsDrawerCount");
    const activeBanner = document.getElementById("tagsActiveBanner");
    const activeName = document.getElementById("tagsActiveName");

    if (!listContainer) return;

    // Sync active banner
    if (activeBanner && activeName) {
      if (this.activeTag) {
        activeBanner.style.display = "flex";
        activeName.textContent = `#${this.activeTag}`;
      } else {
        activeBanner.style.display = "none";
      }
    }

    const allTags = this.getAllTagsWithCounts();
    const q = (filterQuery || "").trim().toLowerCase();

    const filtered = q 
      ? allTags.filter(item => item.name.toLowerCase().includes(q))
      : allTags;

    // Sort: highest video count first, then alphabetical
    filtered.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    if (countLabel) {
      countLabel.textContent = `${allTags.length} tag${allTags.length === 1 ? "" : "s"} available`;
    }

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="drawer-empty-state">
          <svg class="icon" style="width: 28px; height: 28px; margin-bottom: 8px; color: var(--text-dimmed);" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <p>${q ? `No tags matching "<strong>${q}</strong>"` : "No tags found yet. Tags added to videos will appear here."}</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = "";
    filtered.forEach(item => {
      const btn = document.createElement("button");
      const isSelected = this.activeTag && this.activeTag.toLowerCase() === item.name.toLowerCase();
      btn.className = `drawer-tag-item ${isSelected ? "active" : ""}`;
      btn.type = "button";
      btn.innerHTML = `
        <span class="tag-name">#${item.name}</span>
        <span class="tag-video-count">${item.count} video${item.count === 1 ? "" : "s"}</span>
      `;
      btn.addEventListener("click", () => {
        this.selectTagFilter(item.name);
      });
      listContainer.appendChild(btn);
    });
  }

  selectTagFilter(tagName) {
    if (!tagName) return;
    const clean = String(tagName).replace(/^#+/, "").trim();
    this.activeTag = clean;
    this.closeTagsDrawer();
    this.renderCategoryChips();
    this.syncBurgerButtonUI();
    this.renderFeed();
    window.showToast(`Filtered by #${clean}`);
  }

  clearTagFilter() {
    this.activeTag = null;
    this.renderCategoryChips();
    this.syncBurgerButtonUI();
    this.renderFeed();
    if (this.tagsDrawerOverlay?.classList.contains("open")) {
      this.renderTagsDrawer(this.tagsDrawerSearchInput?.value || "");
    }
    window.showToast("Showing all categories");
  }

  syncBurgerButtonUI() {
    const burgerBtn = document.getElementById("tagsBurgerBtn");
    const activeDot = document.getElementById("tagsActiveDot");
    if (this.activeTag) {
      burgerBtn?.classList.add("has-active-tag");
      if (activeDot) activeDot.style.display = "inline-block";
    } else {
      burgerBtn?.classList.remove("has-active-tag");
      if (activeDot) activeDot.style.display = "none";
    }
  }

  // --- Render Category Chips (Standard categories only, NO tag clutter) ---
  renderCategoryChips() {
    if (!this.chipsContainer) return;
    this.chipsContainer.innerHTML = "";

    const basePills = Array.isArray(MERO_CATEGORIES) && MERO_CATEGORIES.length > 0
      ? [...MERO_CATEGORIES]
      : ["All", "Newest", "Most viewed", "Longest"];

    // Render base category buttons
    basePills.forEach(cat => {
      const btn = document.createElement("button");
      const isSelected = !this.activeTag && cat.toLowerCase() === this.activeCategory.toLowerCase();
      btn.className = `chip-btn ${isSelected ? "active" : ""}`;
      btn.textContent = cat;
      btn.addEventListener("click", () => {
        this.activeCategory = cat;
        this.activeTag = null;
        this.updateActiveChipUI();
        this.syncBurgerButtonUI();
        this.renderCategoryChips();
        this.renderFeed();
      });
      this.chipsContainer.appendChild(btn);
    });

    // If an active tag was chosen from the side drawer, display a distinct dismissible pill in the bar
    if (this.activeTag) {
      const tagChip = document.createElement("button");
      tagChip.className = "chip-btn active tag-active-chip";
      tagChip.type = "button";
      tagChip.title = `Active filter: #${this.activeTag}. Click to clear.`;
      tagChip.innerHTML = `
        <span>#${this.activeTag}</span>
        <span class="chip-remove-icon" aria-label="Clear filter">✕</span>
      `;
      tagChip.addEventListener("click", () => {
        this.clearTagFilter();
      });
      this.chipsContainer.appendChild(tagChip);
    }
  }

  updateActiveChipUI() {
    if (!this.chipsContainer) return;
    const chips = this.chipsContainer.querySelectorAll(".chip-btn:not(.tag-active-chip)");
    chips.forEach(chip => {
      const isSelected = !this.activeTag && chip.textContent.toLowerCase() === this.activeCategory.toLowerCase();
      chip.classList.toggle("active", isSelected);
    });
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

    let list = customVideoList ? [...customVideoList] : [...(window.MERO_VIDEOS || [])];

    const active = (this.activeCategory || "All").trim();
    const activeLower = active.toLowerCase();

    // 1. Tag filter (if active from tags drawer)
    if (this.activeTag) {
      const targetTag = this.activeTag.toLowerCase();
      list = list.filter(v => {
        return Array.isArray(v.tags) && v.tags.some(t => {
          const tClean = String(t).replace(/^#+/, "").trim().toLowerCase();
          return tClean === targetTag;
        });
      });
    }

    // 2. Sort or filter by active category
    if (activeLower === "newest") {
      list.sort((a, b) => this._getVideoTimestamp(b) - this._getVideoTimestamp(a));
    } else if (activeLower === "most viewed") {
      list.sort((a, b) => this._parseViews(b.views) - this._parseViews(a.views));
    } else if (activeLower === "longest") {
      list.sort((a, b) => {
        const durA = this._parseDuration(a.duration, a.durationFormatted);
        const durB = this._parseDuration(b.duration, b.durationFormatted);
        return durB - durA;
      });
    } else if (activeLower !== "all") {
      list = list.filter(v => {
        const catMatch = v.category && v.category.toLowerCase() === activeLower;
        return catMatch;
      });
    }

    // 2. Filter by search query (including tags)
    if (this.searchQuery) {
      const q = this.searchQuery.replace(/^#+/, "").trim().toLowerCase();
      list = list.filter(v => {
        const matchTitle = v.title && v.title.toLowerCase().includes(q);
        const matchCreator = v.channel?.name && v.channel.name.toLowerCase().includes(q);
        const matchCategory = v.category && v.category.toLowerCase().includes(q);
        const matchDesc = v.description && v.description.toLowerCase().includes(q);
        const matchTags = Array.isArray(v.tags) && v.tags.some(t => {
          const tClean = String(t).replace(/^#+/, "").trim().toLowerCase();
          return tClean.includes(q);
        });
        return matchTitle || matchCreator || matchCategory || matchDesc || matchTags;
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
      this.renderCategoryChips();
      if (window.meroApp && window.meroApp.currentView && window.meroApp.currentView !== "home") {
        window.meroApp.handleRouteContent(window.meroApp.currentView);
      } else {
        this.renderFeed();
      }
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
          <button class="btn-empty-action" id="emptyUploadFirstVideoBtn" onclick="window.openUploadModal ? window.openUploadModal() : (window.meroUpload ? window.meroUpload.handleUploadTrigger() : window.openAuthModal?.('Sign in to upload and share your videos on Mero.'))">
            <svg class="icon" style="width: 18px; height: 18px; stroke: #fff;" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>Upload First Video</span>
          </button>
        </div>
      `;

      const uploadBtn = document.getElementById("emptyUploadFirstVideoBtn");
      if (uploadBtn) {
        uploadBtn.addEventListener("click", (e) => {
          e.preventDefault();
          if (typeof window.openUploadModal === "function") {
            window.openUploadModal();
          } else if (window.meroUpload?.handleUploadTrigger) {
            window.meroUpload.handleUploadTrigger();
          } else {
            window.openAuthModal?.("Sign in to upload and share your videos on Mero.");
          }
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
        this.activeTag = null;
        this.searchQuery = "";
        const searchInput = document.getElementById("searchInput");
        if (searchInput) searchInput.value = "";
        this.updateActiveChipUI();
        this.syncBurgerButtonUI();
        this.renderCategoryChips();
        this.renderFeed();
      });
    }
  }
}

window.meroFeed = new MeroFeedController();

