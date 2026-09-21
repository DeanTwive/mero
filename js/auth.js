/* ==========================================================================
   Mero Firebase Authentication Manager
   Google Sign-In, Email/Password, Auth Observer, & Modal UI
   ========================================================================== */

import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { auth } from "./firebase.js";

export const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Cdefs%3E%3ClinearGradient id='bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%231e293b'/%3E%3Cstop offset='100%25' stop-color='%230f172a'/%3E%3C/linearGradient%3E%3ClinearGradient id='usr' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23818cf8'/%3E%3Cstop offset='100%25' stop-color='%2338bdf8'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='48' height='48' rx='24' fill='url(%23bg)'/%3E%3Ccircle cx='24' cy='18' r='7.5' fill='url(%23usr)'/%3E%3Cpath d='M10 40c0-7.732 6.268-14 14-14s14 6.268 14 14' fill='url(%23usr)' opacity='0.9'/%3E%3C/svg%3E";
if (typeof window !== "undefined") window.DEFAULT_AVATAR = DEFAULT_AVATAR;

class MeroAuthManager {
  constructor() {
    this.currentUser = null;
    this.googleProvider = new GoogleAuthProvider();
    this.authModal = null;
    this.authCallback = null;
  }

  init() {
    this.authModal = document.getElementById("authModal");
    this.bindAuthEvents();
    this.syncAuthUI(null);

    // Listen to Firebase Auth state
    onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
      console.log("👤 Auth state updated:", user ? `${user.displayName || user.email} (${user.uid})` : "Logged out");
      this.syncAuthUI(user);

      // Notify entire app
      window.dispatchEvent(new CustomEvent("mero:auth-state-changed", { detail: { user } }));

      // If user is currently on a protected route, re-render it
      if (window.meroApp && ["subscriptions", "library"].includes(window.meroApp.currentView)) {
        window.meroApp.handleRouteContent(window.meroApp.currentView);
      }
    });
  }

  bindAuthEvents() {
    // Top bar Sign-In button (if present)
    const topSignInBtn = document.getElementById("topSignInBtn");
    if (topSignInBtn) {
      topSignInBtn.addEventListener("click", () => this.openAuthModal());
    }

    // User Avatar button (pops up login modal if not logged in, or toggles dropdown if logged in)
    const userAvatarBtn = document.getElementById("userAvatarBtn");
    const userProfileMenu = document.getElementById("userProfileMenu");
    const userProfileDropdown = document.getElementById("userProfileDropdown");

    const handleAvatarTrigger = (e) => {
      e.stopPropagation();
      if (!this.currentUser) {
        this.openAuthModal();
      } else if (userProfileDropdown) {
        userProfileDropdown.classList.toggle("active");
      }
    };

    if (userAvatarBtn) {
      userAvatarBtn.addEventListener("click", handleAvatarTrigger);
    } else if (userProfileMenu) {
      userProfileMenu.addEventListener("click", handleAvatarTrigger);
    }

    document.addEventListener("click", () => {
      if (userProfileDropdown) userProfileDropdown.classList.remove("active");
    });

    // Sign out button
    const signOutBtn = document.getElementById("dropdownSignOutBtn");
    if (signOutBtn) {
      signOutBtn.addEventListener("click", () => this.signOutUser());
    }

    // Modal Close
    const closeBtn = document.getElementById("authModalCloseBtn");
    if (closeBtn && this.authModal) {
      closeBtn.addEventListener("click", () => this.closeAuthModal());
    }

    if (this.authModal) {
      this.authModal.addEventListener("click", (e) => {
        if (e.target === this.authModal) this.closeAuthModal();
      });
    }

    // Auth Modal Tabs (Sign In vs Create Account)
    const tabSignIn = document.getElementById("authTabSignIn");
    const tabSignUp = document.getElementById("authTabSignUp");
    const formSignIn = document.getElementById("formSignIn");
    const formSignUp = document.getElementById("formSignUp");

    if (tabSignIn && tabSignUp) {
      tabSignIn.addEventListener("click", () => {
        tabSignIn.classList.add("active");
        tabSignUp.classList.remove("active");
        formSignIn.style.display = "flex";
        formSignUp.style.display = "none";
        this.clearAuthErrors();
      });

      tabSignUp.addEventListener("click", () => {
        tabSignUp.classList.add("active");
        tabSignIn.classList.remove("active");
        formSignUp.style.display = "flex";
        formSignIn.style.display = "none";
        this.clearAuthErrors();
      });
    }

    // Google Sign-In Buttons (both in modal and auth gates)
    const googleBtns = document.querySelectorAll(".btn-google-auth");
    googleBtns.forEach(btn => {
      btn.addEventListener("click", () => this.signInWithGoogle());
    });

    // Email/Password Sign-In Form
    if (formSignIn) {
      formSignIn.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("signInEmail").value.trim();
        const pass = document.getElementById("signInPassword").value;
        if (!email || !pass) return;

        try {
          this.setLoading(true);
          const cred = await signInWithEmailAndPassword(auth, email, pass);
          window.showToast("Signed in successfully!");
          this.closeAuthModal();
          if (typeof this.authCallback === "function") {
            this.authCallback(cred.user);
            this.authCallback = null;
          }
        } catch (err) {
          this.showAuthError(this.formatAuthError(err.code));
        } finally {
          this.setLoading(false);
        }
      });
    }

    // Email/Password Sign-Up Form
    if (formSignUp) {
      formSignUp.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("signUpName").value.trim();
        const email = document.getElementById("signUpEmail").value.trim();
        const pass = document.getElementById("signUpPassword").value;
        if (!email || !pass) return;

        try {
          this.setLoading(true);
          const cred = await createUserWithEmailAndPassword(auth, email, pass);
          if (name && cred.user) {
            await updateProfile(cred.user, { displayName: name });
          }
          window.showToast("Account created successfully!");
          this.closeAuthModal();
          if (typeof this.authCallback === "function") {
            this.authCallback(cred.user);
            this.authCallback = null;
          }
        } catch (err) {
          this.showAuthError(this.formatAuthError(err.code));
        } finally {
          this.setLoading(false);
        }
      });
    }
  }

  // --- Auth Actions ---
  async signInWithGoogle() {
    try {
      this.setLoading(true);
      const res = await signInWithPopup(auth, this.googleProvider);
      window.showToast(`Welcome back, ${res.user.displayName || "Creator"}!`);
      this.closeAuthModal();
      if (typeof this.authCallback === "function") {
        this.authCallback(res.user);
        this.authCallback = null;
      }
    } catch (err) {
      console.warn("Google Sign-In:", err);
      if (err.code !== "auth/popup-closed-by-user") {
        this.showAuthError(this.formatAuthError(err.code));
      }
    } finally {
      this.setLoading(false);
    }
  }

  async signOutUser() {
    try {
      await signOut(auth);
      window.showToast("Signed out");
      // If user was on a protected view, return to home
      if (window.meroApp && ["subscriptions", "library"].includes(window.meroApp.currentView)) {
        window.meroApp.navigateTo("home");
      }
    } catch (err) {
      console.error("Sign out error:", err);
    }
  }

  // --- UI State Sync ---
  syncAuthUI(user) {
    const topSignInBtn = document.getElementById("topSignInBtn");
    const userProfileMenu = document.getElementById("userProfileMenu");
    const userAvatarBtn = document.getElementById("userAvatarBtn");
    const userAvatarImg = document.getElementById("topUserAvatar");
    const defaultUserIcon = document.getElementById("defaultUserIcon");
    const userDisplayName = document.getElementById("dropdownUserName");
    const userEmail = document.getElementById("dropdownUserEmail");
    const guestItems = document.querySelectorAll(".guest-only");
    const memberItems = document.querySelectorAll(".member-only");

    if (topSignInBtn) topSignInBtn.style.display = "none";
    if (userProfileMenu) userProfileMenu.style.display = "flex";

    if (user) {
      const photo = user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.displayName || user.email)}&backgroundColor=6366f1,06b6d4`;
      if (defaultUserIcon) defaultUserIcon.style.display = "none";
      if (userAvatarImg) {
        userAvatarImg.src = photo;
        userAvatarImg.style.display = "block";
      }
      if (userAvatarBtn) {
        userAvatarBtn.title = "Account Menu";
        userAvatarBtn.setAttribute("aria-label", "User Account Menu");
      }
      if (userDisplayName) userDisplayName.textContent = user.displayName || "Creator";
      if (userEmail) userEmail.textContent = user.email || "";
      guestItems.forEach(el => el.style.display = "none");
      memberItems.forEach(el => el.style.display = "flex");
    } else {
      if (defaultUserIcon) defaultUserIcon.style.display = "block";
      if (userAvatarImg) userAvatarImg.style.display = "none";
      if (userAvatarBtn) {
        userAvatarBtn.title = "Sign In / Create Account";
        userAvatarBtn.setAttribute("aria-label", "Sign In or Create Account");
      }
      if (userDisplayName) userDisplayName.textContent = "Guest";
      if (userEmail) userEmail.textContent = "Sign in to Mero";
      guestItems.forEach(el => el.style.display = "flex");
      memberItems.forEach(el => el.style.display = "none");
    }
  }

  openAuthModal(reason = null, callback = null) {
    this.authCallback = callback;
    if (!this.authModal) {
      this.authModal = document.getElementById("authModal");
    }
    const reasonEl = document.getElementById("authModalReason");
    if (reasonEl) {
      reasonEl.textContent = reason || "Sign in to access creator tools, subscriptions, and upload videos.";
    }
    this.clearAuthErrors();
    if (this.authModal) {
      this.authModal.classList.add("active");
      document.body.classList.add("modal-open");
      console.log("🔓 [MeroAuth] Opened Auth Modal:", reason || "Default");
    } else {
      console.error("❌ [MeroAuth] #authModal not found in DOM!");
    }
  }

  closeAuthModal() {
    if (!this.authModal) {
      this.authModal = document.getElementById("authModal");
    }
    if (this.authModal) {
      this.authModal.classList.remove("active");
      document.body.classList.remove("modal-open");
    }
    this.clearAuthErrors();
  }

  showAuthError(msg) {
    const errEl = document.getElementById("authErrorMessage");
    if (errEl) {
      errEl.textContent = msg;
      errEl.style.display = "block";
    }
  }

  clearAuthErrors() {
    const errEl = document.getElementById("authErrorMessage");
    if (errEl) {
      errEl.textContent = "";
      errEl.style.display = "none";
    }
  }

  setLoading(isLoading) {
    const btns = document.querySelectorAll("#authModal button[type='submit']");
    btns.forEach(b => {
      b.disabled = isLoading;
      b.style.opacity = isLoading ? "0.6" : "1";
    });
  }

  formatAuthError(code) {
    switch (code) {
      case "auth/invalid-email": return "Please enter a valid email address.";
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential": return "Invalid email or password.";
      case "auth/email-already-in-use": return "An account with this email already exists.";
      case "auth/weak-password": return "Password should be at least 6 characters.";
      case "auth/unauthorized-domain": return "Domain not authorized in Firebase Console.";
      default: return "Authentication error. Please try again.";
    }
  }
}

export const meroAuth = new MeroAuthManager();
window.meroAuth = meroAuth;

// Override the early fallback with the real implementation
window.openAuthModal = (reason, callback) => meroAuth.openAuthModal(reason, callback);
window.closeAuthModal = () => meroAuth.closeAuthModal();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    meroAuth.init();
    // Pick up any callback that was set before the module loaded
    if (window._pendingAuthCallback) {
      meroAuth.authCallback = window._pendingAuthCallback;
      window._pendingAuthCallback = null;
    }
  });
} else {
  meroAuth.init();
  // Pick up any callback that was set before the module loaded
  if (window._pendingAuthCallback) {
    meroAuth.authCallback = window._pendingAuthCallback;
    window._pendingAuthCallback = null;
  }
}
