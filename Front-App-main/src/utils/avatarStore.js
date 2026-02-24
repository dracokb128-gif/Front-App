// src/utils/avatarStore.js
import React, { useEffect, useState } from "react";
import { API_BASE } from "../api";

export const DEFAULT_AVATAR_URL = "/photo_2025-09-12_21-00-08.jpg";
const keyFor = (uid) => `avatar_src:${String(uid || "guest").replace(/^u/i, "")}`;

export const getUid = () => (localStorage.getItem("uid") || "guest");

export function cachedAvatar(uid = getUid()) {
  try { return localStorage.getItem(keyFor(uid)) || DEFAULT_AVATAR_URL; } catch { return DEFAULT_AVATAR_URL; }
}

export async function fetchAndCacheAvatar(uid = getUid()) {
  try {
    const res = await fetch(`${API_BASE}/api/users/${encodeURIComponent(uid)}/avatar`, {
      credentials: "include",
      cache: "no-store",
    });
    const j = await res.json().catch(() => ({}));
    if (j?.avatar) {
      localStorage.setItem(keyFor(uid), j.avatar);
      return j.avatar;
    }
  } catch {}
  return null;
}

export async function ensureAvatar(uid = getUid()) {
  const ls = cachedAvatar(uid);
  if (ls && ls !== DEFAULT_AVATAR_URL) return ls;
  const remote = await fetchAndCacheAvatar(uid);
  return remote || ls || DEFAULT_AVATAR_URL;
}

export async function saveAvatar(dataURL, uid = getUid()) {
  try {
    await fetch(`${API_BASE}/api/users/${encodeURIComponent(uid)}/avatar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ dataURL })
    });
  } catch {}
  // Always mirror locally too
  localStorage.setItem(keyFor(uid), dataURL);
  try { window.dispatchEvent(new Event("avatar:changed")); } catch {}
  return dataURL;
}

export function clearAvatar(uid = getUid()) {
  try { localStorage.removeItem(keyFor(uid)); } catch {}
  try { window.dispatchEvent(new Event("avatar:changed")); } catch {}
}

/* Small hook for convenience */
export function useAvatarSrc(uid0) {
  const uid = uid0 || getUid();
  const [src, setSrc] = useState(() => cachedAvatar(uid));
  useEffect(() => {
    let alive = true;
    ensureAvatar(uid).then((u) => { if (alive) setSrc(u); });
    const on = () => setSrc(cachedAvatar(uid));
    window.addEventListener("avatar:changed", on);
    return () => { alive = false; window.removeEventListener("avatar:changed", on); };
  }, [uid]);
  return src;
}
