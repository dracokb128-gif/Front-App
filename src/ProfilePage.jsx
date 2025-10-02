// src/ServicePage.jsx
import React, { useEffect, useState } from "react";
import { FiChevronRight, FiHeadphones, FiHelpCircle } from "react-icons/fi";

const HERO =
  "https://sdmntpreastus2.oaiusercontent.com/files/00000000-7868-61f6-af04-cc9a1ce5c9da/raw?se=2025-09-30T12%3A36%3A06Z&sp=r&sv=2024-08-04&sr=b&scid=1ba7e8ba-515c-5c95-96cf-3fd1b740a73d&skoid=3cb6de21-012a-49c9-9402-a1ebf8d0bd06&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-09-29T23%3A24%3A00Z&ske=2025-09-30T23%3A24%3A00Z&sks=b&skv=2024-08-04&sig=zTL0owClpKvq8yb7pxlte/f5MoDIshf/gtE1sA48zLY%3D";

/* ---------------- Service Page ---------------- */
export default function ServicePage() {
  const [csUrl, setCsUrl] = useState("");

  // ✅ Load CS URL from backend
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/cs-link", { credentials: "include" });
        const data = await res.json();
        if (res.ok && data && typeof data.url === "string") {
          setCsUrl(data.url || "");
        } else {
          setCsUrl("");
        }
      } catch {
        setCsUrl("");
      }
    })();
  }, []);

  function openCS() {
    const v = (csUrl || "").trim();
    if (!v) return alert("No customer service link is set by Admin.");
    window.open(v, "_blank");
  }

  return (
    <div className="svc">
      {/* Hero section */}
      <div className="svc-hero">
        <img src={HERO} alt="hero" />
      </div>

      {/* Options */}
      <div className="svc-list">
        <button className="svc-item" onClick={openCS}>
          <div className="svc-ico">
            <FiHeadphones />
          </div>
          <div className="svc-label">Online customer service</div>
          <FiChevronRight className="svc-arrow" />
        </button>

        <button
          className="svc-item"
          onClick={() => alert("FAQ / Help section (to be added)")}
        >
          <div className="svc-ico">
            <FiHelpCircle />
          </div>
          <div className="svc-label">Help Center</div>
          <FiChevronRight className="svc-arrow" />
        </button>
      </div>
    </div>
  );
}
