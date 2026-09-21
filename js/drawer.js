/* ==========================================================================
   Mero Sliding Drawer & Secondary Tabs Controller
   Chapters, Comments, Transcript/Info & Up-Next Queue
   ========================================================================== */

class MeroDrawerController {
  constructor() {
    this.drawerEl = null;
    this.backdropEl = null;
    this.bodyEl = null;
    this.activeTab = "chapters";
    this.currentVideo = null;
  }

  init() {
    this.drawerEl = document.getElementById("slidingDrawer");
    this.backdropEl = document.getElementById("drawerBackdrop");
    this.bodyEl = document.getElementById("drawerBody");

    const closeBtn = document.getElementById("drawerCloseBtn");
    if (closeBtn) closeBtn.addEventListener("click", () => this.closeDrawer());
    if (this.backdropEl) this.backdropEl.addEventListener("click", () => this.closeDrawer());

    // Tab buttons
    const tabBtns = document.querySelectorAll(".drawer-tab-btn");
    tabBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });
  }

  openDrawer(initialTab = null) {
    if (initialTab) {
      this.switchTab(initialTab);
    }
    if (this.drawerEl) this.drawerEl.classList.add("open");
    if (this.backdropEl) this.backdropEl.classList.add("open");
  }

  closeDrawer() {
    if (this.drawerEl) this.drawerEl.classList.remove("open");
    if (this.backdropEl) this.backdropEl.classList.remove("open");
  }

  switchTab(tabName) {
    this.activeTab = tabName;
    document.querySelectorAll(".drawer-tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });
    this.renderActiveTabContent();
  }

  setVideo(video) {
    this.currentVideo = video;
    this.renderActiveTabContent();
  }

  renderActiveTabContent() {
    if (!this.bodyEl || !this.currentVideo) return;

    if (this.activeTab === "chapters") {
      this.renderChaptersTab();
    } else if (this.activeTab === "comments") {
      this.renderCommentsTab();
    } else if (this.activeTab === "info") {
      this.renderInfoTab();
    } else if (this.activeTab === "queue") {
      this.renderQueueTab();
    }
  }

  // --- 1. Chapters Tab ---
  renderChaptersTab() {
    const chapters = this.currentVideo.chapters || [];
    if (chapters.length === 0) {
      this.bodyEl.innerHTML = `<p class="subtitle" style="text-align: center; padding: 24px;">No chapter timestamps available for this video.</p>`;
      return;
    }

    let html = `<div style="display: flex; flex-direction: column; gap: 8px;">`;
    chapters.forEach(ch => {
      const formattedTime = window.meroPlayer.formatTime(ch.time);
      html += `
        <div class="chapter-list-item" data-time="${ch.time}">
          <span class="chapter-item-time">${formattedTime}</span>
          <span class="chapter-item-title">${ch.title}</span>
          <svg class="icon" style="width: 16px; height: 16px; stroke: var(--text-dimmed);" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        </div>
      `;
    });
    html += `</div>`;
    this.bodyEl.innerHTML = html;

    // Click on chapter to seek video
    this.bodyEl.querySelectorAll(".chapter-list-item").forEach(item => {
      item.addEventListener("click", () => {
        const time = parseFloat(item.dataset.time || "0");
        window.meroPlayer.seekTo(time);
        window.showToast(`Jumped to ${window.meroPlayer.formatTime(time)}`);
        // On mobile, close drawer after picking chapter
        if (window.innerWidth < 1024) {
          this.closeDrawer();
        }
      });
    });
  }

  // --- 2. Comments Tab ---
  renderCommentsTab() {
    const comments = window.meroStore.getVideoComments(this.currentVideo.id, this.currentVideo.comments);

    let html = `
      <div class="comments-input-wrap">
        <textarea class="comment-input-field" id="newCommentInput" placeholder="Add a public comment..." rows="1"></textarea>
        <button class="btn-post-comment" id="postCommentBtn">Comment</button>
      </div>
      <div class="comments-list" id="commentsList" style="display: flex; flex-direction: column;">
    `;

    if (comments.length === 0) {
      html += `<p class="subtitle" style="text-align: center; padding: 32px 0;">Be the first to comment on this video!</p>`;
    } else {
      comments.forEach(c => {
        const isLiked = window.meroStore.isCommentLiked(c.id);
        const displayLikes = c.likes + (isLiked ? 1 : 0);
        html += `
          <div class="comment-item" data-id="${c.id}">
            <img class="comment-avatar" src="${c.avatar}" alt="${c.author}" />
            <div class="comment-content">
              <div class="comment-author-row">
                <span class="comment-author-name">${c.author}</span>
                <span class="comment-time">${c.time}</span>
              </div>
              <p class="comment-body">${c.text}</p>
              <div class="comment-actions">
                <button class="comment-like-btn ${isLiked ? "liked" : ""}" data-comment-id="${c.id}">
                  <svg class="icon" style="width: 15px; height: 15px;" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                  <span>${displayLikes > 0 ? displayLikes : "Like"}</span>
                </button>
                <button class="comment-like-btn" style="color: var(--text-dimmed);">Reply</button>
              </div>
            </div>
          </div>
        `;
      });
    }

    html += `</div>`;
    this.bodyEl.innerHTML = html;

    // Bind Post Comment Button
    const postBtn = document.getElementById("postCommentBtn");
    const inputField = document.getElementById("newCommentInput");
    if (postBtn && inputField) {
      postBtn.addEventListener("click", () => {
        const text = inputField.value.trim();
        if (!text) return;
        window.meroStore.addComment(this.currentVideo.id, text);
        inputField.value = "";
        window.showToast("Comment posted!");
        this.renderCommentsTab();
      });
    }

    // Bind Like Comment Buttons
    this.bodyEl.querySelectorAll(".comment-like-btn[data-comment-id]").forEach(btn => {
      btn.addEventListener("click", () => {
        const cId = btn.dataset.commentId;
        window.meroStore.toggleLikeComment(cId);
        this.renderCommentsTab();
      });
    });
  }

  // --- 3. Info Tab ---
  renderInfoTab() {
    const v = this.currentVideo;
    this.bodyEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <h3 style="font-size: 1.1rem; color: #ffffff;">${v.title}</h3>
          <div style="display: flex; gap: 8px; font-size: 0.8rem; color: var(--text-muted);">
            <span>${v.views}</span>
            <span>•</span>
            <span>${v.uploadedAt}</span>
            <span>•</span>
            <span style="color: var(--color-accent); font-weight: 700;">#${v.category}</span>
          </div>
        </div>
        <div style="background: var(--bg-surface-1); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--glass-border);">
          <p style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6; white-space: pre-line;">${v.description}</p>
        </div>
      </div>
    `;
  }

  // --- 4. Queue Tab (Up Next) ---
  renderQueueTab() {
    const list = window.MERO_VIDEOS || [];
    const otherVideos = list.filter(v => v.id !== this.currentVideo?.id);
    if (otherVideos.length === 0) {
      this.bodyEl.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-dimmed); font-size: 0.85rem;">No more videos in queue</div>`;
      return;
    }
    let html = `<div style="display: flex; flex-direction: column; gap: 12px;">`;
    otherVideos.forEach(v => {
      html += `
        <div class="queue-video-item" data-video-id="${v.id}" style="display: flex; gap: 12px; padding: 8px; border-radius: var(--radius-md); cursor: pointer; background: var(--bg-surface-1); border: 1px solid var(--glass-border);">
          <img src="${v.thumbnail}" style="width: 100px; height: 56px; border-radius: var(--radius-sm); object-fit: cover;" alt="${v.title}" />
          <div style="display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1;">
            <h4 class="line-clamp-2" style="font-size: 0.82rem; font-weight: 700; color: var(--text-primary);">${v.title}</h4>
            <span style="font-size: 0.72rem; color: var(--text-muted);">${v.channel.name}</span>
            <span style="font-size: 0.7rem; color: var(--text-dimmed);">${v.views}</span>
          </div>
        </div>
      `;
    });
    html += `</div>`;
    this.bodyEl.innerHTML = html;

    this.bodyEl.querySelectorAll(".queue-video-item").forEach(item => {
      item.addEventListener("click", () => {
        const vidId = item.dataset.videoId;
        window.meroApp.openWatchPage(vidId);
        if (window.innerWidth < 1024) this.closeDrawer();
      });
    });
  }
}

window.meroDrawer = new MeroDrawerController();
