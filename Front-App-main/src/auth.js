// src/auth.js

// active user id read helper
export function getActiveUserId() {
  try {
    return (
      localStorage.getItem("uid") ||
      localStorage.getItem("activeUserId") ||
      ""
    );
  } catch {
    return "";
  }
}

// yahi wo function hai jo App.js expect kar raha hai
export function isAuthed() {
  return !!getActiveUserId();
}

// simple admin flag (agar tum isAdmin flag save karte ho to yahan se check hoga)
export function isAdmin() {
  try {
    return (
      localStorage.getItem("isAdmin") === "1" ||
      localStorage.getItem("role") === "admin"
    );
  } catch {
    return false;
  }
}

// front-end side “soft login” (sirf kuch info store karta hai)
// NOTE: actual auth backend pe hoti hai (api.loginApi use hota hai)
export function login(payload = {}) {
  try {
    if (payload.username) {
      localStorage.setItem("username", String(payload.username));
    }
    // uid ko yahan set NA karo — backend se set hota hai
    // (agar zarurat ho to:
    //  if (payload.id != null) localStorage.setItem("uid", String(payload.id));)
  } catch {}
}

// logout: local storage saaf
export function logout() {
  try {
    localStorage.removeItem("uid");
    localStorage.removeItem("activeUserId");
    localStorage.removeItem("username");
    localStorage.removeItem("isAdmin");
    localStorage.removeItem("role");
  } catch {}
}
