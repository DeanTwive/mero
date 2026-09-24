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

    // HLS.js instance for Bunny Stream .m3u8 playback on Chrome/Firefox
    this._hlsInstance = null;

    // Video Storyboard / Timeline Frame Preview Strip
    this.storyboardStrip = null;
    this.storyboardTrack = null;
    this.storyboardScrollLeft = null;
    this.storyboardScrollRight = null;
    this._storyboardCards = [];
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

    // Video Storyboard Preview Strip Elements
    this.storyboardStrip = document.getElementById("videoStoryboardStrip");
    this.storyboardTrack = document.getElementById("storyboardTrack");
    this.storyboardScrollLeft = document.getElementById("storyboardScrollLeft");
    this.storyboardScrollRight = document.getElementById("storyboardScrollRight");

    this.bindEvents();
    this.bindMiniPlayerEvents();
    this.bindStoryboardEvents();
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
    this.videoEl.addEventListener("loadedmetadata", () => {
      if (this.currentVideo) {
        if (this.videoEl.duration && (!this.currentVideo.duration || Math.abs(this.currentVideo.duration - this.videoEl.duration) > 1)) {
          this.currentVideo.duration = this.videoEl.duration;
        }
        this.updateStoryboardAspectRatio();
      }
    });

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

    const onFullscreenChange = () => {
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (this.playerWrap) {
        this.playerWrap.classList.toggle("is-fullscreen", isFs);
      }
      this.updateFullscreenBtnUI(isFs);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    if (this.videoEl) {
      this.videoEl.addEventListener("webkitbeginfullscreen", () => onFullscreenChange());
      this.videoEl.addEventListener("webkitendfullscreen", () => onFullscreenChange());
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
      // Destroy any active HLS instance before switching to iframe mode
      this._destroyHls();
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
        this.videoEl.poster = video.thumbnail || "";

        let src = video.videoSrc || "";
        // Auto-fix legacy invalid Bunny CDN hostname if present
        if (src.includes("vz-759040.b-cdn.net")) {
          src = src.replace("vz-759040.b-cdn.net", "vz-95ca6a68-303.b-cdn.net");
          video.videoSrc = src;
        }
        if (video.thumbnail && video.thumbnail.includes("vz-759040.b-cdn.net")) {
          video.thumbnail = video.thumbnail.replace("vz-759040.b-cdn.net", "vz-95ca6a68-303.b-cdn.net");
        }

        const isHls = /\.m3u8(\?|$)/i.test(src);

        if (isHls) {
          // ── HLS Stream (Bunny.net Stream) ──────────────────────────
          if (this.videoEl.canPlayType("application/vnd.apple.mpegurl")) {
            // Safari: native HLS support
            this._destroyHls();
            this.videoEl.src = src;
            this.videoEl.load();
            if (autoPlay) {
              this.videoEl.play().catch(() => {});
            }
          } else {
            // Chrome / Firefox / Edge: use HLS.js
            this._loadHlsJs().then((Hls) => {
              this._destroyHls();
              if (Hls && Hls.isSupported()) {
                this._hlsInstance = new Hls({
                  startLevel: -1,          // Automatic initial resolution based on network
                  enableWorker: true,       // Web Worker thread for stutter-free 60fps video
                  lowLatencyMode: false,
                  backBufferLength: 90,     // Buffer 90s behind for instant seek back
                  maxBufferLength: 30,      // Buffer 30s ahead for ultra-smooth playback
                  maxMaxBufferLength: 600,
                  maxBufferSize: 60 * 1000 * 1000,
                  maxBufferHole: 0.5,
                  highBufferWatchdogPeriod: 2,
                  nudgeOffset: 0.1,
                  nudgeMaxRetry: 5
                });

                this._hlsInstance.loadSource(src);
                this._hlsInstance.attachMedia(this.videoEl);

                this._hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
                  if (autoPlay) {
                    this.videoEl.play().catch(err => {
                      console.warn("AutoPlay prevented by browser policy:", err);
                    });
                  }
                });

                // Robust error handling and fallback
                this._hlsInstance.on(Hls.Events.ERROR, (event, data) => {
                  if (data.fatal) {
                    console.warn("HLS fatal error:", data.type, data.details);
                    switch (data.type) {
                      case Hls.ErrorTypes.NETWORK_ERROR:
                        if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
                            data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT) {
                          // Playlist not accessible or transcoding in progress — seamlessly switch to embed player
                          console.warn("Playlist not ready, falling back to embed player");
                          this._fallbackToIframe(video);
                        } else {
                          this._hlsInstance.startLoad();
                        }
                        break;
                      case Hls.ErrorTypes.MEDIA_ERROR:
                        this._hlsInstance.recoverMediaError();
                        break;
                      default:
                        this._destroyHls();
                        this._fallbackToIframe(video);
                        break;
                    }
                  }
                });
              } else {
                this._fallbackToIframe(video);
              }
            }).catch(err => {
              console.error("Failed to initialize hls.js:", err);
              this._fallbackToIframe(video);
            });
            return; // early return — hls.js handles playback
          }
        } else {
          // ── Direct video file (MP4 / WebM / blob URL) ────────────────
          this._destroyHls();
          this.videoEl.src = src;
          this.videoEl.load();
          if (autoPlay) {
            this.videoEl.play().catch(() => {});
          }
        }
      }
    }

    // Build scrubber chapter tick marks
    this.renderChapterMarkers(video.chapters || [], video.duration);

    // Build timeline frame preview storyboard strip
    this.renderStoryboardPreview(video);

    // Save into watch history
    window.meroStore.recordHistory(video.id, 0);

    // Sync miniplayer
    this.updateMiniPlayerDetails(video);
  }

  /** Destroy any active hls.js instance and free memory. */
  _destroyHls() {
    if (this._hlsInstance) {
      this._hlsInstance.destroy();
      this._hlsInstance = null;
    }
  }

  /** Seamless fallback to iframe embed if HLS is unavailable or transcoding. */
  _fallbackToIframe(video) {
    const fallbackUrl = video?.originalUrl || 
      (video?.storagePath ? `https://iframe.mediadelivery.net/embed/759040/${video.storagePath}?autoplay=true&loop=false&muted=false&preload=true` : null);
    if (this.iframeEl && fallbackUrl) {
      this._destroyHls();
      if (this.playerWrap) this.playerWrap.classList.add("is-iframe-mode");
      if (this.videoEl) {
        this.videoEl.pause();
        this.videoEl.style.display = "none";
      }
      this.iframeEl.style.display = "block";
      this.iframeEl.src = fallbackUrl;
    }
  }

  /**
   * Lazily load hls.js from CDN and return the Hls constructor.
   * Cached after first load so subsequent calls are instant.
   * @returns {Promise<typeof Hls>}
   */
  _loadHlsJs() {
    if (window.Hls) return Promise.resolve(window.Hls);
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js";
      script.onload = () => resolve(window.Hls);
      script.onerror = () => reject(new Error("Failed to load hls.js"));
      document.head.appendChild(script);
    });
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

    // Sync active storyboard preview frame
    this.syncActiveStoryboard(cur);

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
      this.videoEl.play().catch(err => console.warn("Playback error:", err));
    } else {
      this.videoEl.pause();
    }
  }

  seekRelative(deltaSeconds) {
    if (!this.videoEl) return;
    this.videoEl.currentTime = Math.max(0, Math.min(this.videoEl.duration || 999, this.videoEl.currentTime + deltaSeconds));
    this.showGestureIndicator(deltaSeconds > 0 ? "right" : "left", `${deltaSeconds > 0 ? "+" : ""}${deltaSeconds}s`);
  }

  handleGestureTap(e) {
    // Ignore clicks on buttons, links, or scrubber
    if (e.target.closest("button") || e.target.closest("a") || e.target.closest(".scrubber-wrap")) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const widthRatio = clickX / rect.width;

    const now = Date.now();
    if (this._lastTapTime && (now - this._lastTapTime) < 300) {
      // Double tap detected: skip backwards or forwards
      clearTimeout(this._singleTapTimeout);
      this._singleTapTimeout = null;
      this._lastTapTime = 0;

      if (widthRatio < 0.35) {
        this.seekRelative(-10);
      } else if (widthRatio > 0.65) {
        this.seekRelative(10);
      } else {
        this.togglePlay();
      }
    } else {
      // Single tap candidate: toggle play/pause smoothly
      this._lastTapTime = now;
      this._singleTapTimeout = setTimeout(() => {
        this._singleTapTimeout = null;
        this.togglePlay();
      }, 250);
    }
  }

  showGestureIndicator(side, text) {
    const el = document.getElementById(side === "right" ? "gestureRight" : "gestureLeft");
    if (!el) return;
    const label = el.querySelector(".gesture-label");
    if (label && text) label.textContent = text;
    el.style.display = "flex";
    el.style.animation = "none";
    void el.offsetWidth; // Trigger reflow to restart pulse
    el.style.animation = "popPulse 0.5s ease-out";
    clearTimeout(this[`_gestTimer_${side}`]);
    this[`_gestTimer_${side}`] = setTimeout(() => {
      el.style.display = "none";
    }, 500);
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

  // --- Storyboard Timeline Preview Strip ---
  bindStoryboardEvents() {
    if (this.storyboardScrollLeft) {
      this.storyboardScrollLeft.addEventListener("click", () => this.scrollStoryboard(-260));
    }
    if (this.storyboardScrollRight) {
      this.storyboardScrollRight.addEventListener("click", () => this.scrollStoryboard(260));
    }
    if (this.storyboardTrack) {
      this.storyboardTrack.addEventListener("wheel", (e) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          this.storyboardTrack.scrollLeft += e.deltaY;
        }
      }, { passive: false });
    }
  }

  scrollStoryboard(distance) {
    if (this.storyboardTrack) {
      this.storyboardTrack.scrollBy({ left: distance, behavior: "smooth" });
    }
  }

  renderStoryboardPreview(video) {
    if (!this.storyboardTrack || !video) return;
    this.storyboardTrack.innerHTML = "";
    this._storyboardCards = [];

    const dur = Math.max(1, video.duration || this.videoEl?.duration || 32);

    // Detect aspect ratio from actual video element if metadata loaded
    const hasVideoDims = this.videoEl && this.videoEl.videoWidth > 0 && this.videoEl.videoHeight > 0;
    const isVideoPortrait = hasVideoDims
      ? (this.videoEl.videoHeight > this.videoEl.videoWidth)
      : (video.isPortrait || false);
    const videoRatio = hasVideoDims
      ? (this.videoEl.videoWidth / this.videoEl.videoHeight)
      : (isVideoPortrait ? (9 / 16) : (16 / 9));

    const isBunny = video.storageType === "bunny_stream" || 
                    (video.videoSrc && /vz-[a-zA-Z0-9-]+\.b-cdn\.net/i.test(video.videoSrc));

    if (isBunny) {
      let guid = video.storagePath;
      if (!guid && video.videoSrc) {
        const match = video.videoSrc.match(/https:\/\/[^/]+\/([a-f0-9-]+)\//i);
        if (match) guid = match[1];
      }
      const cdnHost = video.videoSrc ? new URL(video.videoSrc).origin : "https://vz-95ca6a68-303.b-cdn.net";

      if (guid) {
        const seekUrl = `${cdnHost}/${guid}/seek/_0.jpg`;
        // Bunny seek sprite grid: 6 columns × 6 rows
        const COLS = 6;
        const ROWS = 6;
        const totalFrames = video.seekPicNum || 16;

        // Probe the sprite image to extract exact cell aspect ratio from the image itself
        const probeImg = new Image();
        probeImg.crossOrigin = "anonymous";
        probeImg.onload = () => {
          const naturalW = probeImg.naturalWidth || 1800;
          const naturalH = probeImg.naturalHeight || Math.round(naturalW * 16 / 9);
          const cellW = naturalW / COLS;
          const cellH = naturalH / ROWS;
          const cellIsPortrait = cellH > cellW;
          const cellRatio = cellW / cellH;

          // Clear any placeholder cards before building
          this.storyboardTrack.innerHTML = "";
          this._storyboardCards = [];

          // Exactly 6 timeline preview frames for every video
          const TARGET_FRAMES = 6;
          const availableFrames = Math.min(36, video.seekPicNum || 16);

          for (let k = 0; k < TARGET_FRAMES; k++) {
            const frameIndex = Math.min(
              availableFrames - 1,
              Math.round((k / (TARGET_FRAMES - 1)) * (availableFrames - 1))
            );
            const time = (k / (TARGET_FRAMES - 1)) * dur;
            const col = frameIndex % COLS;
            const row = Math.floor(frameIndex / COLS);

            const card = document.createElement("div");
            card.className = "storyboard-card" +
              (k === 0 ? " is-active" : "") +
              (cellIsPortrait ? " is-portrait" : "");
            card.dataset.time = time.toFixed(2);
            card.dataset.index = k;
            card.dataset.sprite = "true";
            card.style.aspectRatio = `${cellRatio}`;
            card.title = `Jump to ${this.formatTime(time)}`;

            // Mathematically exact percentage offsets for 6x6 sprite sheet:
            const bgSizeX = `${COLS * 100}%`;
            const bgSizeY = `${ROWS * 100}%`;
            const bgPosX = (col / (COLS - 1)) * 100;
            const bgPosY = (row / (ROWS - 1)) * 100;

            card.innerHTML = `
              <div class="storyboard-thumb" style="
                background-image: url('${seekUrl}');
                background-size: ${bgSizeX} ${bgSizeY};
                background-position: ${bgPosX}% ${bgPosY}%;
                background-repeat: no-repeat;
              "></div>
              <span class="storyboard-time-badge">${this.formatTime(time)}</span>
              <div class="storyboard-play-hint">
                <svg class="icon" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              </div>
            `;

            card.addEventListener("click", () => {
              this.seekTo(time);
              if (this.videoEl && this.videoEl.paused) {
                this.videoEl.play().catch(() => {});
              }
              this.setActiveStoryboardCard(card, false);
              window.showToast(`Jumped to ${this.formatTime(time)}`);
            });

            this.storyboardTrack.appendChild(card);
            this._storyboardCards.push({ element: card, time });
          }

          if (this.storyboardStrip) this.storyboardStrip.style.display = "flex";
        };

        probeImg.onerror = () => {
          // Sprite not available — fallback to video thumbnail
          this._renderDefaultStoryboard(video, dur, isVideoPortrait, videoRatio);
        };

        probeImg.src = seekUrl;
        return;
      }
    }

    // Fallback: chapters (limit to 6)
    if (video.chapters && video.chapters.length > 1) {
      const chList = video.chapters.length > 6 
        ? [0, 1, 2, 3, 4, 5].map(idx => video.chapters[Math.round((idx / 5) * (video.chapters.length - 1))])
        : video.chapters;
      chList.forEach((ch, idx) => {
        const card = document.createElement("div");
        card.className = "storyboard-card" +
          (idx === 0 ? " is-active" : "") +
          (isVideoPortrait ? " is-portrait" : "");
        card.dataset.time = ch.time;
        card.style.aspectRatio = `${videoRatio}`;
        card.title = `${ch.title} (${this.formatTime(ch.time)})`;

        card.innerHTML = `
          <div class="storyboard-thumb" style="
            background-image: url('${video.thumbnail || ""}');
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
          "></div>
          <span class="storyboard-time-badge">${this.formatTime(ch.time)}</span>
          <div class="storyboard-play-hint">
            <svg class="icon" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          </div>
        `;

        card.addEventListener("click", () => {
          this.seekTo(ch.time);
          if (this.videoEl && this.videoEl.paused) {
            this.videoEl.play().catch(() => {});
          }
          this.setActiveStoryboardCard(card, false);
          window.showToast(`Jumped to ${ch.title} (${this.formatTime(ch.time)})`);
        });

        this.storyboardTrack.appendChild(card);
        this._storyboardCards.push({ element: card, time: ch.time });
      });
      if (this.storyboardStrip) this.storyboardStrip.style.display = "flex";
      return;
    }

    this._renderDefaultStoryboard(video, dur, isVideoPortrait, videoRatio);
  }

  _renderDefaultStoryboard(video, dur, isPortrait, ratio) {
    const frameCount = 6;
    const finalRatio = ratio || (isPortrait ? (9 / 16) : (16 / 9));
    for (let i = 0; i < frameCount; i++) {
      const time = (i / (frameCount > 1 ? (frameCount - 1) : 1)) * dur;
      const card = document.createElement("div");
      card.className = "storyboard-card" +
        (i === 0 ? " is-active" : "") +
        (isPortrait ? " is-portrait" : "");
      card.dataset.time = time.toFixed(2);
      card.style.aspectRatio = `${finalRatio}`;
      card.title = `Jump to ${this.formatTime(time)}`;

      card.innerHTML = `
        <div class="storyboard-thumb" style="
          background-image: url('${video.thumbnail || ""}');
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
        "></div>
        <span class="storyboard-time-badge">${this.formatTime(time)}</span>
        <div class="storyboard-play-hint">
          <svg class="icon" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        </div>
      `;

      card.addEventListener("click", () => {
        this.seekTo(time);
        if (this.videoEl && this.videoEl.paused) {
          this.videoEl.play().catch(() => {});
        }
        this.setActiveStoryboardCard(card, false);
        window.showToast(`Jumped to ${this.formatTime(time)}`);
      });

      this.storyboardTrack.appendChild(card);
      this._storyboardCards.push({ element: card, time });
    }
    if (this.storyboardStrip) this.storyboardStrip.style.display = "flex";
  }

  updateStoryboardAspectRatio() {
    if (!this.videoEl || !this.videoEl.videoWidth || !this.videoEl.videoHeight) return;
    const isPortrait = this.videoEl.videoHeight > this.videoEl.videoWidth;
    const ratio = this.videoEl.videoWidth / this.videoEl.videoHeight;
    if (this.storyboardTrack) {
      this.storyboardTrack.querySelectorAll(".storyboard-card:not([data-sprite])").forEach(card => {
        card.style.aspectRatio = `${ratio}`;
        card.classList.toggle("is-portrait", isPortrait);
      });
    }
  }

  syncActiveStoryboard(currentTime) {
    if (!this._storyboardCards || this._storyboardCards.length === 0) return;

    let activeIndex = 0;
    for (let i = 0; i < this._storyboardCards.length; i++) {
      if (currentTime >= this._storyboardCards[i].time) {
        activeIndex = i;
      } else {
        break;
      }
    }

    const target = this._storyboardCards[activeIndex];
    if (target && !target.element.classList.contains("is-active")) {
      this.setActiveStoryboardCard(target.element, true);
    }
  }

  setActiveStoryboardCard(card, autoScroll = true) {
    if (!this.storyboardTrack || !card) return;
    this.storyboardTrack.querySelectorAll(".storyboard-card").forEach(c => {
      c.classList.toggle("is-active", c === card);
    });
    if (autoScroll) {
      card.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
    }
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
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (!isFs) {
      const el = this.playerWrap;
      if (el && el.requestFullscreen) {
        el.requestFullscreen().catch(err => {
          console.warn("requestFullscreen failed, falling back to video element:", err);
          if (this.videoEl && this.videoEl.webkitEnterFullscreen) {
            this.videoEl.webkitEnterFullscreen();
          } else if (this.videoEl && this.videoEl.requestFullscreen) {
            this.videoEl.requestFullscreen().catch(e => console.warn(e));
          }
        });
      } else if (el && el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      } else if (this.videoEl && this.videoEl.webkitEnterFullscreen) {
        this.videoEl.webkitEnterFullscreen();
      } else if (this.videoEl && this.videoEl.requestFullscreen) {
        this.videoEl.requestFullscreen().catch(err => console.warn(err));
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => console.warn(err));
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  }

  updateFullscreenBtnUI(isFs) {
    const fsBtn = document.getElementById("playerFullscreenBtn");
    if (!fsBtn) return;
    if (isFs) {
      fsBtn.setAttribute("title", "Exit Fullscreen (F)");
      fsBtn.setAttribute("aria-label", "Exit Fullscreen");
      fsBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>`;
    } else {
      fsBtn.setAttribute("title", "Fullscreen (F)");
      fsBtn.setAttribute("aria-label", "Fullscreen");
      fsBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>`;
    }
  }

  togglePip() {
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture();
    } else if (document.pictureInPictureEnabled && this.videoEl) {
      if (this.videoEl.readyState < 1) {
        window.showToast("Video is still loading...");
        return;
      }
      this.videoEl.requestPictureInPicture().catch(err => console.warn("PiP error:", err));
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
