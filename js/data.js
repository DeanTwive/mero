/* ==========================================================================
   Mero Data Layer (100% Real Dynamic Content)
   Zero Dummy Data - Populated Strictly from Firebase Firestore
   ========================================================================== */

// Real active videos list loaded from Firebase Cloud Firestore
let MERO_VIDEOS = [];

const MERO_CATEGORIES = [
  "All",
  "Tech",
  "Coding",
  "Lo-Fi",
  "Gaming",
  "Design",
  "AI",
  "Music"
];

// Load real videos from Cloud Firestore
async function fetchMeroVideos() {
  if (!window.meroDb) {
    // Wait up to 3.5s for module script to mount window.meroDb
    await new Promise((resolve) => {
      let attempts = 0;
      const check = setInterval(() => {
        attempts++;
        if (window.meroDb || attempts >= 35) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }

  if (window.meroDb) {
    const videos = await window.meroDb.getVideos();
    MERO_VIDEOS = videos;
    window.MERO_VIDEOS = videos;
    return videos;
  }
  return [];
}

// Generate sharp cinematic dark SVG poster for uploaded videos
function generateAutoThumbnail(title, category) {
  const primaryColors = ["#6366f1", "#06b6d4", "#a855f7", "#10b981", "#f59e0b", "#f43f5e"];
  const accentColors = ["#38bdf8", "#ec4899", "#34d399", "#fbbf24", "#818cf8", "#22d3ee"];
  const randIdx = Math.abs(title.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)) % primaryColors.length;

  const pColor = primaryColors[randIdx];
  const aColor = accentColors[randIdx];

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="100%" height="100%">
    <defs>
      <linearGradient id="bgG" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#090d16" />
        <stop offset="50%" stop-color="#0f1524" />
        <stop offset="100%" stop-color="#161f33" />
      </linearGradient>
      <linearGradient id="glowG" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${pColor}" />
        <stop offset="100%" stop-color="${aColor}" />
      </linearGradient>
      <radialGradient id="rGlow" cx="85%" cy="15%" r="65%">
        <stop offset="0%" stop-color="${aColor}" stop-opacity="0.28" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0" />
      </radialGradient>
      <pattern id="dotGrid" width="28" height="28" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1.2" fill="rgba(255,255,255,0.08)" />
      </pattern>
    </defs>
    <rect width="640" height="360" fill="url(#bgG)" />
    <rect width="640" height="360" fill="url(#rGlow)" />
    <rect width="640" height="360" fill="url(#dotGrid)" />

    <g transform="translate(44, 48)">
      <rect x="0" y="0" width="100" height="28" rx="14" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.14)" />
      <text x="50" y="18" fill="${aColor}" font-family="system-ui, sans-serif" font-size="11" font-weight="800" letter-spacing="1.5" text-anchor="middle">${category.toUpperCase()}</text>

      <g transform="translate(420, 60)">
        <circle cx="60" cy="60" r="64" fill="rgba(13,18,28,0.7)" stroke="url(#glowG)" stroke-width="2.5" />
        <polygon points="52 42 76 60 52 78" fill="${aColor}" />
      </g>

      <text x="0" y="105" fill="#ffffff" font-family="system-ui, sans-serif" font-size="30" font-weight="900" letter-spacing="-0.03em">
        ${title.length > 26 ? title.substring(0, 26) + "..." : title}
      </text>

      <rect x="0" y="195" width="280" height="38" rx="8" fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.08)" />
      <circle cx="20" cy="214" r="4" fill="${pColor}" />
      <text x="34" y="218" fill="#94a3b8" font-family="monospace" font-size="12" font-weight="700">MERO CREATOR STREAM</text>
    </g>
    <rect x="0" y="355" width="640" height="5" fill="url(#glowG)" />
  </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

window.MERO_VIDEOS = MERO_VIDEOS;
window.MERO_CATEGORIES = MERO_CATEGORIES;
window.fetchMeroVideos = fetchMeroVideos;
window.generateAutoThumbnail = generateAutoThumbnail;
