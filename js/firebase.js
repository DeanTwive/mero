/* ==========================================================================
   Firebase SDK Integration for Mero
   Project ID: mero-dev-903e3
   ========================================================================== */

import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAL5eKUNDTztSlnsZK4GTagytg8LrCbIik",
  authDomain: "mero-dev-903e3.firebaseapp.com",
  projectId: "mero-dev-903e3",
  storageBucket: "mero-dev-903e3.firebasestorage.app",
  messagingSenderId: "326642125810",
  appId: "1:326642125810:web:afbd05941e5b07319f396b",
  measurementId: "G-YJXRH6ZT1T"
};

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Cloud Firestore
export const db = getFirestore(app);

// Initialize Cloud Storage (Firebase Storage)
export const storage = getStorage(app);

// Initialize Firebase Analytics safely
export let analytics = null;
if (typeof window !== "undefined") {
  isSupported().then(supported => {
    if (supported) {
      analytics = getAnalytics(app);
      console.log("📊 Firebase Analytics initialized [mero-dev-903e3]");
    }
  }).catch(err => {
    console.warn("Analytics not supported in this environment:", err);
  });
}

// Global reference for application access
window.meroFirebase = {
  app,
  auth,
  db,
  storage,
  getAnalytics: () => analytics,
  config: firebaseConfig
};

console.log("🔥 Connected to Firebase project: mero-dev-903e3 (Auth, Firestore & Storage ready)");
