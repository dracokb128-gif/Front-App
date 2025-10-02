import React, { useEffect, useRef, useState } from "react";
import { FiChevronLeft, FiCamera, FiTrash2 } from "react-icons/fi";
import { API_BASE, getAvatar, setAvatar, deleteAvatar } from "./api";

const DEFAULT_AVATAR_URL = "/photo_2025-09-12_21-00-08.jpg";

/* helpers */
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
function downscale(dataURL, maxSide = 640, quality = 0.9) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.src = dataURL;
  });
}

const abs = (u) => (u && !/^https?:/i.test(u) ? `${API_BASE}${u}` : u || "");
const bust = (u) => (u ? `${u}${u.includes("?") ? "&" : "?"}v=${Date.now()}` : u);

// ✅ key helpers
function avatarKey() {
  const uid = localStorage.getItem("uid") || "guest";
  return `avatar_src:${uid}`;
}

export default function ProfilePage() {
  const uid = localStorage.getItem("uid") || "guest";
  const key = avatarKey();
  const [src, setSrc] = useState(() => localStorage.getItem(key) || DEFAULT_AVATAR_URL);
  const inputRef = useRef(null);

  // Load from server on mount (so history clear ke baad bhi aa jaye)
  useEffect(() => {
    (async () => {
      try {
        const r = await getAvatar(uid);
        if (r?.url) {
          const url = bust(r.url);
          localStorage.setItem(key, url);
          setSrc(url);
        }
      } catch {
        // ignore; fallback to local/default
      }
    })();
  }, [uid, key]);

  const onBack = () => window.history.back();
  const pickFile = () => inputRef.current?.click();

  const onChoose = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { alert("Please select an image."); return; }
    try {
      const raw = await fileToDataURL(f);
      const small = await downscale(raw, 720, 0.9);

      // save to server disk
      const saved = await setAvatar(uid, small);
      const url = bust(saved?.url || "");
      if (url) {
        localStorage.setItem(key, url);   // store URL (not data:)
        setSrc(url);
        window.dispatchEvent(new Event("avatar:changed"));
      } else {
        // fallback: local only
        localStorage.setItem(key, small);
        setSrc(small);
        window.dispatchEvent(new Event("avatar:changed"));
      }
    } catch {
      alert("Could not load image.");
    } finally {
      e.target.value = "";
    }
  };

  const resetAvatar = async () => {
    try { await deleteAvatar(uid); } catch {}
    localStorage.removeItem(key);
    setSrc(DEFAULT_AVATAR_URL);
    window.dispatchEvent(new Event("avatar:changed"));
  };

  return (
    <div className="profile-page">
      <div className="subhead">
        <button className="back" onClick={onBack} aria-label="Back">
          <FiChevronLeft />
        </button>
        <div className="title">Profile</div>
        <div className="right-space" />
      </div>

      <div className="wrap" style={{ padding: 16, maxWidth: 540, margin: "0 auto" }}>
        <div style={{ display: "grid", placeItems: "center", marginTop: 14 }}>
          <div
            style={{
              position: "relative",
              width: 120,
              height: 120,
              borderRadius: "50%",
              overflow: "hidden",
              background: "#f1f5f9",
              border: "6px solid #fff",
              boxShadow: "0 10px 24px rgba(0,0,0,.08)",
            }}
          >
            <img
              src={src}
              alt="Avatar"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR_URL; }}
            />
            <button
              onClick={pickFile}
              type="button"
              title="Change picture"
              style={{
                position: "absolute",
                right: 6,
                bottom: 6,
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "#fff",
                display: "grid",
                placeItems: "center",
                boxShadow: "0 6px 16px rgba(0,0,0,.15)",
                border: 0,
                cursor: "pointer",
              }}
            >
              <FiCamera style={{ fontSize: 18, opacity: 0.85 }} />
            </button>
          </div>
        </div>

        <button type="button" onClick={pickFile} style={btnStyle}>
          <FiCamera style={{ marginRight: 8 }} />
          Change profile picture
        </button>

        <button
          type="button"
          onClick={resetAvatar}
          style={{ ...btnStyle, marginTop: 10, background: "#e7eef6", color: "#1f2937", boxShadow: "none" }}
        >
          <FiTrash2 style={{ marginRight: 8 }} />
          Reset to default
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onChoose}
          style={{ display: "none" }}
        />
      </div>
    </div>
  );
}

const btnStyle = {
  width: "100%",
  height: 48,
  marginTop: 20,
  border: 0,
  cursor: "pointer",
  borderRadius: 12,
  fontWeight: 700,
  fontSize: 15,
  color: "#fff",
  background: "linear-gradient(90deg,#ff5f6d,#ff9f43)",
  boxShadow: "0 10px 24px rgba(255,95,109,.25)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
