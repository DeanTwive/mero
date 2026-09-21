/* ==========================================================================
   Mero Custom Video Player & Ambient Cinema Controller
   60 FPS Canvas Glow, Custom Scrubber, Speed Pills, Chapters & Gestures
   ========================================================================== */

class MeroPlayerController {
  constructor() {
    this.currentVideo = null;
    this.videoEl = null;
    this.playerWrap = null;
    this.ambientCanvas = null;
    this.ambientCtx = null;
    this.ambientInterval = null;
    this.isAmbientEnabled = true;

    this.scrubberWrap = null;
    this.scrubberProgress = null;
    this.scrubberBuffer = null;
    this.scrubberThumb = null;
    this.scrubberTooltip = null;
    this.isScrubbing = false;

    this.timeDisplay = null;
    this.playBtn = null;
    this.bigPlayBtn = null;
    this.volumeSlider = null;
    this.volumeBtn = null;

    this.sleepTimerId = null;
    this.sleepTimerEndAt = null;

    this.userInactivityTimer = null;
    this.lastTapTime = 0;
    this.lastTapX = 0;
  }

  init() {
    this.playerWrap = document.getElementById("meroPlayer");
    this.videoEl = document.getElementById("meroVideo");
    this.iframeEl = document.getElementById("meroIframe");
    this.ambientCanvas = document.getElementById("ambientCanvas");
    if (this.ambientCanvas) {
      this.ambientCtx = this.ambientCanvas.getContext("2d", { willReadFrequently: true });
    }

    this.scrubberWrap = document.getElementById("playerScrubber");
    this.scrubberProgress = document.getElementById("scrubberProgress");
    this.scrubberBuffer = document.getElementById("scrubberBuffer");
    this.scrubberThumb = document.getElementById("scrubberThumb");
    this.scrubberTooltip = document.getElementById("scrubberTooltip");

    this.timeDisplay = document.getElementById("playerTimeDisplay");
    this.playBtn = document.getElementById("playerPlayBtn");
    this.bigPlayBtn = document.getElementById("playerBigPlayBtn");
    this.volumeSlider = document.getElementById("playerVolumeSlider");
    this.volumeBtn = document.getElementById("playerVolumeBtn");

    this.bindEvents();
    this.bindMiniPlayerEvents();
  }

  bindEvents() {
    if (!this.videoEl) return;

    // Video native events
    this.videoEl.addEventListener("timeupdate", () => this.onTimeUpdate());
    this.videoEl.addEventListener("progress", () => this.onBufferProgress());
    this.videoEl.addEventListener("play", () => this.onPlayStateChange(true));
    this.videoEl.addEventListener("pause", () => this.onPlayStateChange(false));
    this.videoEl.addEventListener("waiting", () => this.playerWrap.classList.add("is-buffering"));
    this.videoEl.addEventListener("canplay", () => this.playerWrap.classList.remove("is-buffering"));
    this.videoEl.addEventListener("ended", () => this.onVideoEnded());

    // Play/Pause button clicks
    if (this.playBtn) this.playBtn.addEventListener("click", () => this.togglePlay());
    if (this.bigPlayBtn) this.bigPlayBtn.addEventListener("click", () => this.togglePlay());

    // Center gesture zone & double tap to skip
    const gestureZone = document.getElementById("centerGestureZone");
    if (gestureZone) {
      gestureZone.addEventListener("click", (e) => this.handleGestureTap(e));
    }

    // Rewind / Forward 10s buttons
    const rewindBtn = document.getElementById("playerRewindBtn");
    const forwardBtn = document.getElementById("playerForwardBtn");
    if (rewindBtn) rewindBtn.addEventListener("click", () => this.seekRelative(-10));
    if (forwardBtn) forwardBtn.addEventListener("click", () => this.seekRelative(10));

    // Scrubber scrubbing
    if (this.scrubberWrap) {
      this.scrubberWrap.addEventListener("mousedown", (e) => this.startScrubbing(e));
      this.scrubberWrap.addEventListener("mousemove", (e) => this.updateScrubberTooltip(e));
      this.scrubberWrap.addEventListener("mouseleave", () => this.hideScrubberTooltip());
      this.scrubberWrap.addEventListener("touchstart", (e) => this.startScrubbing(e.touches[0]), { passive: true });
      this.scrubberWrap.addEventListener("touchmove", (e) => {
        if (this.isScrubbing) this.scrubTo(e.touches[0].clientX);
      }, { passive: true });
    }

    window.addEventListener("mouseup", () => this.stopScrubbing());
    window.addEventListener("touchend", () => this.stopScrubbing());
    window.addEventListener("mousemove", (e) => {
      if (this.isScrubbing) this.scrubTo(e.clientX);
      this.resetUserInactivity();
    });

    // Volume & Mute
    if (this.volumeSlider) {
      this.volumeSlider.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        this.videoEl.volume = val;
        this.videoEl.muted = val === 0;
        this.updateVolumeUI();
        window.meroStore.updateSetting("volume", val);
      });
    }

    if (this.volumeBtn) {
      this.volumeBtn.addEventListener("click", () => {
        this.videoEl.muted = !this.videoEl.muted;
        this.updateVolumeUI();
      });
    }

    // Speed Pills
    const speedPills = document.querySelectorAll(".speed-pill-btn");
    speedPills.forEach(pill => {
      pill.addEventListener("click", () => {
        const speed = parseFloat(pill.dataset.speed || "1");
        this.setSpeed(speed);
      });
    });

    // Ambient Cinema Glow Toggle
    const ambientBtn = document.getElementById("playerAmbientBtn");
    if (ambientBtn) {
      ambientBtn.addEventListener("click", () => {
        this.isAmbientEnabled = !this.isAmbientEnabled;
        const ambientWrap = document.getElementById("playerAmbientWrapper");
        if (ambientWrap) {
          ambientWrap.classList.toggle("ambient-disabled", !this.isAmbientEnabled);
        }
        ambientBtn.classList.toggle("is-active", this.isAmbientEnabled);
        if (this.isAmbientEnabled) {
          this.startAmbientCanvas();
          window.showToast("Ambient Cinema Glow: ON");
        } else {
          this.stopAmbientCanvas();
          window.showToast("Ambient Cinema Glow: OFF");
        }
      });
    }

    // Fullscreen Toggle
    const fsBtn = document.getElementById("playerFullscreenBtn");
    if (fsBtn) {
      fsBtn.addEventListener("click", () => this.toggleFullscreen());
    }

    // Picture-in-Picture
    const pipBtn = document.getElementById("playerPipBtn");
    if (pipBtn) {
      pipBtn.addEventListener("click", () => this.togglePip());
    }
  }

  // --- Load and Play Video ---
  loadVideo(video, autoPlay = true) {
    if (!video) return;
    this.currentVideo = video;

    const titleEl = document.getElementById("playerVideoTitle");
    if (titleEl) titleEl.textContent = video.title;

    // Detect if this is an iframe embed (YouTube, Vimeo, Dailymotion, or flagged isEmbed)
    const isEmbed = video.isEmbed || 
                    video.embedProvider === "youtube" ||
                    video.embedProvider === "vimeo" ||
                    video.embedProvider === "dailymotion" ||
                    /youtube|youtu\.be|vimeo|dailymotion|embed/i.test(video.videoSrc || "");

    if (isEmbed && this.iframeEl) {
      if (this.playerWrap) this.playerWrap.classList.add("is-iframe-mode");
      if (this.videoEl) {
        this.videoEl.pause();
        this.videoEl.style.display = "none";
      }
      this.iframeEl.style.display = "block";
      this.iframeEl.src = video.videoSrc;

      // Soft ambient backlight glow
      this.drawThumbnailAmbientGlow(video.thumbnail);
    } else {
      if (this.playerWrap) this.playerWrap.classList.remove("is-iframe-mode");
      if (this.iframeEl) {
        this.iframeEl.style.display = "none";
        this.iframeEl.src = "about:blank";
      }
      if (this.videoEl) {
        this.videoEl.style.display = "block";
        this.videoEl.src = video.videoSrc;
        this.videoEl.poster = video.thumbnail;
        this.videoEl.load();

        if (autoPlay) {
          this.videoEl.play().catch(() => {
            // Auto-play was prevented by browser policy
          });
        }
      }
    }

    // Build scrubber chapter tick marks
    this.renderChapterMarkers(video.chapters || [], video.duration);

    // Save into watch history
    window.meroStore.recordHistory(video.id, 0);

    // Sync miniplayer
    this.updateMiniPlayerDetails(video);
  }

  drawThumbnailAmbientGlow(thumbUrl) {
    if (!this.ambientCanvas || !this.ambientCtx || !thumbUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        this.ambientCtx.drawImage(img, 0, 0, this.ambientCanvas.width, this.ambientCanvas.height);
      } catch (e) {
        // Fallback for cross-origin image restrictions
      }
    };
    img.src = thumbUrl;
  }

  // --- Time & Buffer Updates ---
  onTimeUpdate() {
    if (!this.videoEl || this.isScrubbing) return;
    const cur = this.videoEl.currentTime || 0;
    const dur = this.videoEl.duration || this.currentVideo?.duration || 1;
    const ratio = (cur / dur) * 100;

    if (this.scrubberProgress) this.scrubberProgress.style.width = `${ratio}%`;
    if (this.timeDisplay) {
      this.timeDisplay.textContent = `${this.formatTime(cur)} / ${this.formatTime(dur)}`;
    }

    // Sync active chapter highlighting
    this.syncActiveChapter(cur);

    // Record progress in store every 5 seconds
    if (Math.floor(cur) % 5 === 0 && this.currentVideo) {
      window.meroStore.recordHistory(this.currentVideo.id, cur / dur);
    }
  }

  onBufferProgress() {
    if (!this.videoEl || !this.videoEl.buffered.length) return;
    const dur = this.videoEl.duration || 1;
    const bufferedEnd = this.videoEl.buffered.end(this.videoEl.buffered.length - 1);
    const ratio = (bufferedEnd / dur) * 100;
    if (this.scrubberBuffer) this.scrubberBuffer.style.width = `${ratio}%`;
  }

  onPlayStateChange(isPlaying) {
    if (isPlaying) {
      this.playerWrap.classList.add("is-playing");
      this.startAmbientCanvas();
      this.resetUserInactivity();
      if (this.playBtn) this.playBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
    } else {
      this.playerWrap.classList.remove("is-playing");
      this.stopAmbientCanvas();
      if (this.playBtn) this.playBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
    }
    this.updateMiniPlayerPlayState(isPlaying);
  }

  onVideoEnded() {
    if (this.sleepTimerEndAt === "end_of_video") {
      this.cancelSleepTimer();
      window.showToast("Sleep timer: Video ended, screen dimmed");
    }
  }

  togglePlay() {
    if (!this.videoEl) return;
    if (this.videoEl.paused) {
      this.videoEl.play();
    } else {
      this.videoEl.pause();
    }
  }

  seekRelative(deltaSeconds) {
    if (!this.videoEl) return;
    this.videoEl.currentTime = Math.max(0, Math.min(this.videoEl.duration || 999, this.videoEl.currentTime + deltaSeconds));
    this.showGestureIndicator(deltaSeconds > 0 ? "right" : "left", `${deltaSeconds > 0 ? "+" : ""}${deltaSeconds}s`);
  }

  seekTo(seconds) {
    if (!this.videoEl) return;
    this.videoEl.currentTime = Math.max(0, Math.min(this.videoEl.duration || 999, seconds));
  }

  setSpeed(rate) {
    if (!this.videoEl) return;
    this.videoEl.playbackRate = rate;
    document.querySelectorAll(".speed-pill-btn").forEach(btn => {
      btn.classList.toggle("active", parseFloat(btn.dataset.speed) === rate);
    });
    window.showToast(`Speed: ${rate}x`);
  }

  // --- Scrubber Dragging & Tooltip ---
  startScrubbing(e) {
    this.isScrubbing = true;
    if (this.scrubberWrap) this.scrubberWrap.classList.add("is-dragging");
    this.scrubTo(e.clientX);
  }

  scrubTo(clientX) {
    if (!this.scrubberWrap || !this.videoEl) return;
    const rect = this.scrubberWrap.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const dur = this.videoEl.duration || this.currentVideo?.duration || 1;
    const targetTime = ratio * dur;

    if (this.scrubberProgress) this.scrubberProgress.style.width = `${ratio * 100}%`;
    if (this.timeDisplay) {
      this.timeDisplay.textContent = `${this.formatTime(targetTime)} / ${this.formatTime(dur)}`;
    }
    this.updateScrubberTooltip({ clientX });
  }

  stopScrubbing() {
    if (!this.isScrubbing) return;
    this.isScrubbing = false;
    if (this.scrubberWrap) this.scrubberWrap.classList.remove("is-dragging");
    if (this.videoEl && this.scrubberProgress) {
      const ratio = parseFloat(this.scrubberProgress.style.width || "0") / 100;
      const dur = this.videoEl.duration || this.currentVideo?.duration || 1;
      this.videoEl.currentTime = ratio * dur;
    }
    this.hideScrubberTooltip();
  }

  updateScrubberTooltip(e) {
    if (!this.scrubberWrap || !this.scrubberTooltip) return;
    const rect = this.scrubberWrap.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const dur = this.videoEl?.duration || this.currentVideo?.duration || 1;
    const hoverTime = ratio * dur;

    const chapter = this.findChapterAtTime(hoverTime);
    this.scrubberTooltip.innerHTML = `
      <span class="tooltip-time">${this.formatTime(hoverTime)}</span>
      ${chapter ? `<span class="tooltip-chapter-title">${chapter.title}</span>` : ""}
    `;
    this.scrubberTooltip.style.left = `${ratio * 100}%`;
    this.scrubberTooltip.classList.add("visible");
  }

  hideScrubberTooltip() {
    if (this.scrubberTooltip) this.scrubberTooltip.classList.remove("visible");
  }

  renderChapterMarkers(chapters, duration) {
    const track = document.getElementById("scrubberTrack");
    if (!track) return;
    // Remove existing markers
    track.querySelectorAll(".chapter-marker").forEach(el => el.remove());

    chapters.forEach(ch => {
      if (ch.time <= 0) return;
      const ratio = (ch.time / duration) * 100;
      const marker = document.createElement("div");
      marker.className = "chapter-marker";
      marker.style.left = `${ratio}%`;
      track.appendChild(marker);
    });
  }

  findChapterAtTime(seconds) {
    if (!this.currentVideo || !this.currentVideo.chapters) return null;
    const chapters = this.currentVideo.chapters;
    let found = chapters[0];
    for (let i = 0; i < chapters.length; i++) {
      if (seconds >= chapters[i].time) {
        found = chapters[i];
      } else {
        break;
      }
    }
    return found;
  }

  syncActiveChapter(seconds) {
    const chapter = this.findChapterAtTime(seconds);
    if (!chapter) return;
    document.querySelectorAll(".chapter-list-item").forEach(item => {
      const cTime = parseFloat(item.dataset.time || "0");
      item.classList.toggle("active", cTime === chapter.time);
    });
  }

  // --- Volume & UI ---
  updateVolumeUI() {
    if (!this.videoEl) return;
    const isMuted = this.videoEl.muted || this.videoEl.volume === 0;
    if (this.volumeSlider) this.volumeSlider.value = isMuted ? 0 : this.videoEl.volume;
    if (this.volumeBtn) {
      this.volumeBtn.innerHTML = isMuted
        ? `<svg class="icon" viewBox="0 0 24 24"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`
        : `<svg class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
    }
  }

  // --- Mobile Double-Tap Gestures ---
  handleGestureTap(e) {
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const tapX = e.clientX - rect.left;
    const isDoubleTap = now - this.lastTapTime < 320 && Math.abs(tapX - this.lastTapX) < 80;

    if (isDoubleTap) {
      if (tapX < rect.width * 0.4) {
        this.seekRelative(-10);
      } else if (tapX > rect.width * 0.6) {
        this.seekRelative(10);
      } else {
        this.togglePlay();
      }
    } else {
      // Single tap: toggle controls overlay visibility
      this.playerWrap.classList.toggle("user-inactive");
    }

    this.lastTapTime = now;
    this.lastTapX = tapX;
  }

  showGestureIndicator(side, label) {
    const ind = document.getElementById(side === "left" ? "gestureLeft" : "gestureRight");
    if (ind) {
      ind.querySelector(".gesture-label").textContent = label;
      ind.style.display = "flex";
      setTimeout(() => { ind.style.display = "none"; }, 500);
    }
  }

  resetUserInactivity() {
    if (!this.playerWrap) return;
    this.playerWrap.classList.remove("user-inactive");
    clearTimeout(this.userInactivityTimer);
    if (!this.videoEl?.paused) {
      this.userInactivityTimer = setTimeout(() => {
        this.playerWrap.classList.add("user-inactive");
      }, 3500);
    }
  }

  // --- Ambient Canvas Backlight ---
  startAmbientCanvas() {
    if (!this.isAmbientEnabled || !this.ambientCtx || !this.videoEl) return;
    this.stopAmbientCanvas();
    this.ambientInterval = setInterval(() => {
      try {
        if (!this.videoEl.paused && !this.videoEl.ended) {
          // Render low-res frame to canvas for soft ambient illumination
          this.ambientCtx.drawImage(this.videoEl, 0, 0, this.ambientCanvas.width, this.ambientCanvas.height);
        }
      } catch (err) {
        // Cross-origin fallback (ignore if strict CORS)
      }
    }, 120);
  }

  stopAmbientCanvas() {
    if (this.ambientInterval) {
      clearInterval(this.ambientInterval);
      this.ambientInterval = null;
    }
  }

  // --- Fullscreen & Picture-in-Picture ---
  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.playerWrap.requestFullscreen().catch(err => console.warn(err));
    } else {
      document.exitFullscreen();
    }
  }

  togglePip() {
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture();
    } else if (document.pictureInPictureEnabled && this.videoEl) {
      this.videoEl.requestPictureInPicture().catch(err => console.warn(err));
    }
  }

  // --- Sleep Timer ---
  setSleepTimer(minutes) {
    this.cancelSleepTimer();
    const sleepBtn = document.getElementById("playerSleepBtn");

    if (minutes === "end_of_video") {
      this.sleepTimerEndAt = "end_of_video";
      if (sleepBtn) sleepBtn.classList.add("is-active");
      window.showToast("Sleep timer: Will pause at the end of video");
      return;
    }

    const ms = minutes * 60 * 1000;
    this.sleepTimerEndAt = Date.now() + ms;
    if (sleepBtn) sleepBtn.classList.add("is-active");
    window.showToast(`Sleep timer set: ${minutes} minutes`);

    this.sleepTimerId = setTimeout(() => {
      if (this.videoEl && !this.videoEl.paused) {
        this.videoEl.pause();
        window.showToast("Sleep timer reached: Video paused. Good night!");
      }
      this.cancelSleepTimer();
    }, ms);
  }

  cancelSleepTimer() {
    if (this.sleepTimerId) {
      clearTimeout(this.sleepTimerId);
      this.sleepTimerId = null;
    }
    this.sleepTimerEndAt = null;
    const sleepBtn = document.getElementById("playerSleepBtn");
    if (sleepBtn) sleepBtn.classList.remove("is-active");
  }

  // --- Mini-Player Controller ---
  bindMiniPlayerEvents() {
    const miniBar = document.getElementById("miniPlayerBar");
    const miniPlayBtn = document.getElementById("miniPlayBtn");
    const miniCloseBtn = document.getElementById("miniCloseBtn");

    if (miniPlayBtn) {
      miniPlayBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.togglePlay();
      });
    }

    if (miniCloseBtn) {
      miniCloseBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.hideMiniPlayer();
        if (this.videoEl) this.videoEl.pause();
      });
    }

    if (miniBar) {
      miniBar.addEventListener("click", () => {
        // Expand back to watch page
        window.meroApp.openWatchPage(this.currentVideo.id, false);
      });
    }
  }

  showMiniPlayer() {
    const miniBar = document.getElementById("miniPlayerBar");
    if (miniBar && this.currentVideo && !this.videoEl?.paused) {
      miniBar.classList.add("active");
    }
  }

  hideMiniPlayer() {
    const miniBar = document.getElementById("miniPlayerBar");
    if (miniBar) miniBar.classList.remove("active");
  }

  updateMiniPlayerDetails(video) {
    const thumb = document.getElementById("miniThumb");
    const title = document.getElementById("miniTitle");
    const creator = document.getElementById("miniCreator");
    if (thumb) thumb.src = video.thumbnail;
    if (title) title.textContent = video.title;
    if (creator) creator.textContent = video.channel.name;
  }

  updateMiniPlayerPlayState(isPlaying) {
    const miniPlayBtn = document.getElementById("miniPlayBtn");
    if (!miniPlayBtn) return;
    miniPlayBtn.innerHTML = isPlaying
      ? `<svg class="icon" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`
      : `<svg class="icon" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
  }

  formatTime(totalSeconds) {
    const s = Math.floor(totalSeconds % 60);
    const m = Math.floor((totalSeconds / 60) % 60);
    const h = Math.floor(totalSeconds / 3600);
    const pad = (n) => String(n).padStart(2, "0");
    if (h > 0) {
      return `${h}:${pad(m)}:${pad(s)}`;
    }
    return `${pad(m)}:${pad(s)}`;
  }
}

window.meroPlayer = new MeroPlayerController();
