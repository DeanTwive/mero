/* ==========================================================================
   Mero Cloud Firestore Database Service
   Real Video Catalog, User Playlists & Channel Subscriptions
   ========================================================================== */

import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  query, 
  orderBy, 
  serverTimestamp 
} from "firebase/firestore";
import { db } from "./firebase.js";

class MeroDbService {
  constructor() {
    this.videosCollection = collection(db, "videos");
    this.tagsCollection = collection(db, "tags");
  }

  // --- Firestore Tags Collection & Seeding ---
  async getTags() {
    try {
      const snap = await getDocs(this.tagsCollection);
      const tags = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.name) {
          tags.push(data.name);
        } else if (d.id) {
          tags.push(d.id.charAt(0).toUpperCase() + d.id.slice(1));
        }
      });

      if (tags.length === 0) {
        return await this.seedDefaultTags();
      }

      return Array.from(new Set(tags)).sort();
    } catch (err) {
      console.warn("Could not fetch tags from Firestore:", err);
      return ["Gaming", "Tech", "Coding", "Lo-Fi", "Design", "Tutorial", "AI", "Music", "Animation", "Vlog", "Podcast", "Entertainment"];
    }
  }

  async seedDefaultTags() {
    const defaultTags = [
      "Gaming", 
      "Tech", 
      "Coding", 
      "Lo-Fi", 
      "Design", 
      "Tutorial", 
      "AI", 
      "Music", 
      "Animation", 
      "Vlog", 
      "Podcast",
      "Entertainment"
    ];

    try {
      for (const name of defaultTags) {
        const tagRef = doc(db, "tags", name.toLowerCase());
        await setDoc(tagRef, {
          name: name,
          slug: name.toLowerCase(),
          createdAt: serverTimestamp()
        }, { merge: true });
      }
    } catch (e) {
      console.warn("Failed to seed tags in Firestore:", e);
    }
    return defaultTags;
  }

  async addTag(tagName) {
    if (!tagName) return;
    const clean = String(tagName).replace(/^#+/, "").trim();
    if (!clean) return;
    const slug = clean.toLowerCase();
    const formatted = clean.charAt(0).toUpperCase() + clean.slice(1);
    try {
      const tagRef = doc(db, "tags", slug);
      await setDoc(tagRef, {
        name: formatted,
        slug: slug,
        createdAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn("Failed to add tag to Firestore:", e);
    }
    return formatted;
  }

  _normalizeVideo(data) {
    if (!data) return data;
    let videoSrc = data.videoSrc || "";
    let thumbnail = data.thumbnail || "";
    if (videoSrc.includes("vz-759040.b-cdn.net")) {
      videoSrc = videoSrc.replace("vz-759040.b-cdn.net", "vz-95ca6a68-303.b-cdn.net");
    }
    if (thumbnail.includes("vz-759040.b-cdn.net")) {
      thumbnail = thumbnail.replace("vz-759040.b-cdn.net", "vz-95ca6a68-303.b-cdn.net");
    }
    // Clean and normalize tags array
    let tags = [];
    if (Array.isArray(data.tags)) {
      tags = data.tags.map(t => String(t).replace(/^#+/, "").trim().toLowerCase()).filter(Boolean);
    } else if (typeof data.tags === "string" && data.tags.trim()) {
      tags = data.tags.split(/[,\s]+/).map(t => t.replace(/^#+/, "").trim().toLowerCase()).filter(Boolean);
    }

    return {
      ...data,
      videoSrc,
      thumbnail,
      tags
    };
  }

  // --- Real Videos Collection ---
  async getVideos() {
    try {
      const q = query(this.videosCollection, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const videos = [];

      snapshot.forEach(docSnap => {
        const rawData = docSnap.data();
        const data = this._normalizeVideo(rawData);
        videos.push({
          id: docSnap.id,
          ...data,
          // Format upload time if timestamp
          uploadedAt: data.uploadedAt || "Recently"
        });
      });

      return videos;
    } catch (err) {
      console.warn("Firestore query error (or collection empty):", err);
      // Fallback to locally published uploads if offline
      try {
        const local = JSON.parse(localStorage.getItem("mero_published_videos") || "[]");
        return local.map(v => this._normalizeVideo(v));
      } catch (e) {
        return [];
      }
    }
  }

  async createVideo(videoData) {
    try {
      const tags = Array.isArray(videoData.tags) ? videoData.tags : [];
      const primaryCategory = tags.length > 0 ? (tags[0].charAt(0).toUpperCase() + tags[0].slice(1)) : (videoData.category || "General");

      const payload = {
        title: videoData.title,
        category: primaryCategory,
        videoSrc: videoData.videoSrc,
        originalUrl: videoData.originalUrl || videoData.videoSrc,
        isEmbed: videoData.isEmbed !== undefined ? videoData.isEmbed : false,
        storageType: videoData.storageType || (videoData.isEmbed ? "embed" : "firebase"),
        storagePath: videoData.storagePath || "",
        embedProvider: videoData.embedProvider || (videoData.isEmbed ? "iframe" : "direct"),
        thumbnail: videoData.thumbnail,
        duration: videoData.duration || 120,
        durationFormatted: videoData.durationFormatted || (videoData.isEmbed ? "Stream" : "2:00"),
        views: "1 view",
        channel: {
          id: videoData.channel?.id || "ch-creator",
          name: videoData.channel?.name || "Creator",
          avatar: videoData.channel?.avatar,
          handle: "@" + (videoData.channel?.name || "creator").toLowerCase().replace(/\s+/g, ""),
          verified: false,
          subscribers: "1 subscriber"
        },
        description: videoData.description || "",
        tags: tags,
        chapters: videoData.chapters || [],
        comments: [],
        createdAt: serverTimestamp(),
        uploadedAt: "Just now"
      };

      const docRef = await addDoc(this.videosCollection, payload);
      const newVideo = { id: docRef.id, ...payload, uploadedAt: "Just now" };

      // Register all tags in Firestore tags collection asynchronously
      tags.forEach(t => this.addTag(t).catch(() => {}));

      // Also cache in local published list
      try {
        const local = JSON.parse(localStorage.getItem("mero_published_videos") || "[]");
        local.unshift(newVideo);
        localStorage.setItem("mero_published_videos", JSON.stringify(local));
      } catch (e) {}

      return newVideo;
    } catch (err) {
      console.error("Error creating video in Firestore:", err);
      // Local fallback
      const fallbackVideo = {
        id: "vid-" + Date.now(),
        ...videoData,
        views: "1 view",
        uploadedAt: "Just now",
        comments: []
      };
      try {
        const local = JSON.parse(localStorage.getItem("mero_published_videos") || "[]");
        local.unshift(fallbackVideo);
        localStorage.setItem("mero_published_videos", JSON.stringify(local));
      } catch (e) {}
      return fallbackVideo;
    }
  }

  // --- User Subscriptions & Watch Later ---
  async getUserData(uid) {
    if (!uid) return { subscriptions: [], watchLater: [] };
    try {
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        return snap.data();
      }
    } catch (err) {
      console.warn("Could not fetch user document from Firestore:", err);
    }
    return { subscriptions: [], watchLater: [] };
  }

  async toggleSubscription(uid, channelId, isSubscribed) {
    if (!uid) return;
    try {
      const userRef = doc(db, "users", uid);
      await setDoc(userRef, {
        subscriptions: isSubscribed ? arrayUnion(channelId) : arrayRemove(channelId)
      }, { merge: true });
    } catch (err) {
      console.warn("Firestore subscription sync error:", err);
    }
  }

  async toggleWatchLater(uid, videoId, isSaved) {
    if (!uid) return;
    try {
      const userRef = doc(db, "users", uid);
      await setDoc(userRef, {
        watchLater: isSaved ? arrayUnion(videoId) : arrayRemove(videoId)
      }, { merge: true });
    } catch (err) {
      console.warn("Firestore watch later sync error:", err);
    }
  }
}

export const meroDb = new MeroDbService();
window.meroDb = meroDb;
window.dispatchEvent(new CustomEvent("mero:db-ready", { detail: { db: meroDb } }));
