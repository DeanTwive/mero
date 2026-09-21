# Mero — Next-Gen Mobile-First Dark Video Platform

**Mero** is a modern, high-performance video streaming platform interface engineered to solve the clutter, accessibility, and ergonomic issues of traditional video platforms like YouTube.

Built with pure vanilla web technologies (HTML5, modern CSS3, modular ES6+ JavaScript), Mero prioritizes **frictionless watching**, **thumb-reach ergonomics on mobile**, and a **deep cinematic dark theme**.

---

## 🚀 Key UI & UX Innovations (Why It's Better than YouTube)

### 1. 📱 Ultra Mobile-First & Thumb-Friendly Ergonomics
- **Bottom Navigation Bar**: 48px+ touch targets positioned within natural thumb reach (`Home`, `Trending`, `Subscriptions`, `Watch Later`).
- **Floating Mini-Player**: When browsing the feed or switching categories while a video is playing, a seamless mini-player drawer slides up at the bottom without interrupting audio or video playback.
- **Single-Tap Mobile Drawer**: Quick-access pills (`Chapters & Timeline`, `Comments`) slide up an interactive bottom drawer with gesture handle without navigating away from the video.
- **Double-Tap Skip Gestures**: Double-tap left to rewind 10s, double-tap right to skip 10s, with tactile animated pulse indicators.

### 2. 🌌 Ambient Cinema Glow & Elevated Dark Palette
- **Multi-Layered Surfaces**: Built on rich deep tones (`#080b11`, `#0d121c`, `#131a29`, `#1a2337`) rather than harsh, eye-straining `#000000`.
- **Dynamic Ambient Glow**: In cinema mode, an ambient canvas extracts real-time visual frames from the video and casts soft ambient lighting onto the backdrop.
- **WCAG 2.1 AA Contrast**: Typography using Google Fonts (*Plus Jakarta Sans* and *JetBrains Mono*) with contrast ratios exceeding 7:1 for body and 12:1 for titles.

### 3. ⏱️ Frictionless Playback Controls
- **1-Tap Playback Speed Pills**: Speed switches (`0.75x`, `1x`, `1.25x`, `1.5x`, `2x`) are directly accessible on the player control bar—no digging into 3 levels of gear-icon menus.
- **Built-in Nighttime Sleep Timer**: Set playback to automatically pause after 15m, 30m, 45m, 60m, or at the *End of Video*, perfect for late-night listening and sleep companion streams.
- **Interactive Chapter Scrubber**: Progress bar features visual chapter markers and real-time hover/touch tooltips indicating the active chapter title and timestamp.

### 4. ⚡ State Completeness & Instant Responsiveness
- **Shimmer Loading Skeletons**: Beautiful skeleton cards matching target dimensions for seamless transitions.
- **Live Instant Search**: Real-time filtering across titles, creator channels, descriptions, and tags with 1-click clear button.
- **Empty & Error Recovery**: Thoughtful empty states with quick "Reset Filters" and "Browse Creators" recovery actions.
- **Zero-Dependency 60 FPS Engine**: Fast initial load, zero npm bloat, and smooth hardware-accelerated animations.

---

## ⌨️ Desktop Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| <kbd>Space</kbd> or <kbd>K</kbd> | Play / Pause |
| <kbd>J</kbd> | Rewind 10 seconds |
| <kbd>L</kbd> | Fast forward 10 seconds |
| <kbd>M</kbd> | Mute / Unmute audio |
| <kbd>F</kbd> | Toggle Fullscreen |
| <kbd>C</kbd> | Toggle Ambient Cinema Glow |

---

## 📂 Project Structure

```
mero/
├── index.html            # Semantic SPA structure, player container, bottom bar, drawer
├── css/
│   ├── design-tokens.css # Color variables, 8pt scale, typography, dark mode elevation
│   ├── base.css          # Reset, smooth typography, custom scrollbars, touch ergonomics
│   ├── player.css        # Video player, ambient glow, custom scrubber, speed pills
│   ├── cards.css         # Video cards, 16:9 ratio, duration badges, shimmer skeleton
│   ├── layout.css        # Responsive grid, desktop sidebar, mobile bottom-bar, miniplayer
│   └── components.css    # Sliding drawer, chapters, comments, sleep timer modal, toasts
├── js/
│   ├── data.js           # Authentic video catalog with chapters, creators, comments
│   ├── store.js          # Reactive local state (subscriptions, history, saved, settings)
│   ├── player.js         # Custom video player controller, ambient lighting, scrubber
│   ├── feed.js           # Card rendering, search, category chip filters, skeleton states
│   ├── drawer.js         # Sliding drawer for chapters/comments/info
│   └── app.js            # Main bootstrap, navigation router, shortcuts, toasts
└── README.md             # Project documentation & features guide
```

---

## 🌐 Running Locally with Live-Reload

Mero runs with **live-server** (WebSocket-based auto reload, similar to nodemon for frontends):

```bash
# Start the live reload server (Watches HTML, CSS, JS)
npm start
# or
npx live-server --port=8085 --no-browser
```

- **URL**: [http://localhost:8085](http://localhost:8085)
- **Instant Hot Updates**: Whenever you edit and save any file (`HTML`, `CSS`, `JS`), the browser updates immediately without getting stuck in a loading state.