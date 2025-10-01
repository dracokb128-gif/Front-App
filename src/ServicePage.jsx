// src/ServicePage.jsx
import React from "react";
import { FiChevronRight, FiHeadphones, FiHelpCircle } from "react-icons/fi";

// Public folder image (stable)
const PUB =
  (typeof process !== "undefined" &&
    process.env &&
    process.env.PUBLIC_URL) ||
  "";
const HERO = `${PUB}/service/hero.jpg`;

// key jahan AdminPage save karta hai
const CS_URL_KEY = "cs_url";

export default function ServicePage() {
  const openExternal = (url) => {
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // fallback
      window.location.href = url;
    }
  };

  const handleOnlineSupport = () => {
    const saved = (localStorage.getItem(CS_URL_KEY) || "").trim();
    const hasHttp = /^https?:\/\//i.test(saved);
    const url = hasHttp ? saved : "https://t.me/"; // fallback

    if (!saved) {
      alert("Customer service link set nahi hai. Admin → Settings me save karo.");
    }
    openExternal(url);
  };

  const handleHelp = () => alert("Help – wire later");

  return (
    <div style={{ background: "#f1f3f6", minHeight: "100%" }}>
      {/* ===== BIG hero (text inside image) ===== */}
      <div style={{ padding: "12px 12px 0" }}>
        <div
          style={{
            position: "relative",
            borderRadius: 20,
            overflow: "hidden",
            width: "98%",
            maxWidth: 540,
            height: "clamp(390px, 68vw, 560px)",
            margin: "0 auto",
            backgroundImage: `url(${HERO})`,
            backgroundSize: "cover",
            backgroundPosition: "center 52%",
          }}
        >
          {/* top gradient for readability */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.18) 30%, rgba(0,0,0,0) 60%)",
              pointerEvents: "none",
            }}
          />
          {/* text inside hero */}
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              right: 16,
              textAlign: "center",
              color: "#fff",
            }}
          >
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: 0.2,
                textShadow: "0 2px 6px rgba(0,0,0,.45)",
              }}
            >
              Customer Service Center
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 13,
                fontWeight: 600,
                opacity: 0.95,
                textShadow: "0 1px 3px rgba(0,0,0,.4)",
              }}
            >
              Online customer service time 07:00-23:00 &nbsp; (UK)
            </div>
          </div>
        </div>
      </div>

      {/* ===== options ===== */}
      <section className="wrap" style={{ padding: 12, maxWidth: 540, margin: "12px auto 0" }}>
        <button type="button" onClick={handleOnlineSupport} style={rowStyle}>
          <div style={rowLeftStyle}>
            <FiHeadphones style={rowIconStyle} />
            <span>Online customer service</span>
          </div>
          <FiChevronRight style={{ opacity: 0.5 }} />
        </button>

        <button type="button" onClick={handleHelp} style={{ ...rowStyle, marginTop: 12 }}>
          <div style={rowLeftStyle}>
            <FiHelpCircle style={rowIconStyle} />
            <span>Help</span>
          </div>
          <FiChevronRight style={{ opacity: 0.5 }} />
        </button>
      </section>

      <div className="bottom-space" />
    </div>
  );
}

const rowStyle = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  background: "#fff",
  border: "1px solid #e9ecf2",
  borderRadius: 14,
  padding: "14px 14px",
  boxShadow: "0 1px 3px rgba(0,0,0,.06)",
  cursor: "pointer",
};
const rowLeftStyle = { display: "flex", alignItems: "center", gap: 10, fontSize: 15, fontWeight: 600 };
const rowIconStyle = { fontSize: 18, opacity: 0.8 };
