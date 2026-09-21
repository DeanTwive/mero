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
  }

  // --- Real Videos Collection ---
  async getVideos() {
    try {
      const q = query(this.videosCollection, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const videos = [];

      snapshot.forEach(docSnap => {
        const data = docSnap.data();
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
        return local;
      } catch (e) {
        return [];
      }
    }
  }

  async createVideo(videoData) {
    try {
      const payload = {
        title: videoData.title,
        category: videoData.category || "General",
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
          id: videoData.channel.id || "ch-creator",
          name: videoData.channel.name || "Creator",
          avatar: videoData.channel.avatar,
          handle: "@" + (videoData.channel.name || "creator").toLowerCase().replace(/\s+/g, ""),
          verified: false,
          subscribers: "1 subscriber"
        },
        description: videoData.description || "",
        chapters: videoData.chapters || [],
        comments: [],
        createdAt: serverTimestamp(),
        uploadedAt: "Just now"
      };

      const docRef = await addDoc(this.videosCollection, payload);
      const newVideo = { id: docRef.id, ...payload, uploadedAt: "Just now" };

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
