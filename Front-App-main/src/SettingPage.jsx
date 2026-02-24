// src/Settings.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const nav = useNavigate();

  const Row = ({ icon, title, onClick }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-white hover:shadow transition"
      style={{ border: "1px solid #eef0f4" }}
      type="button"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden className="inline-flex">{icon}</span>
        <span className="text-[15px] font-medium text-[#1e293b]">{title}</span>
      </div>
      <span aria-hidden className="text-[#cbd5e1]">›</span>
    </button>
  );

  const Card = ({ children }) => (
    <div
      className="w-full rounded-2xl bg-white"
      style={{ border: "1px solid #eef0f4" }}
    >
      <div className="flex flex-col gap-2 p-2">{children}</div>
    </div>
  );

  return (
    <div className="max-w-[560px] mx-auto px-4 py-4">
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => nav(-1)}
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center"
          style={{ border: "1px solid #eef0f4" }}
          aria-label="Back"
          type="button"
        >
          ‹
        </button>
        <h1 className="text-[20px] font-semibold">Setting</h1>
      </div>

      {/* Options */}
      <Card>
        <Row
          title="Change Login Password"
          onClick={() => nav("/setting/change-login")} // aapke flow ke mutabiq
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M7 11V8a5 5 0 1 1 10 0v3" stroke="#2563eb" strokeWidth="1.6" />
              <rect x="4" y="11" width="16" height="9" rx="2.5" stroke="#2563eb" strokeWidth="1.6"/>
            </svg>
          }
        />

        <Row
          title="Change Withdrawal Password"
          onClick={() => alert("Wire later")}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 3v4M8 5h8" stroke="#0ea5e9" strokeWidth="1.6" />
              <rect x="4" y="9" width="16" height="10" rx="2.5" stroke="#0ea5e9" strokeWidth="1.6"/>
            </svg>
          }
        />

        {/* NEW: Change Wallet Address (same UI, no logic) */}
        <Row
          title="Change Wallet Address"
          onClick={() => alert("Wire later")}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M3 7.5a2.5 2.5 0 0 1 2.5-2.5H17a2 2 0 0 1 2 2v2" stroke="#6366f1" strokeWidth="1.6"/>
              <rect x="3" y="7" width="18" height="10" rx="2.5" stroke="#6366f1" strokeWidth="1.6"/>
              <circle cx="16" cy="12" r="1.4" fill="none" stroke="#6366f1" strokeWidth="1.6"/>
            </svg>
          }
        />

        <Row
          title="Language"
          onClick={() => alert("Wire later")}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 5h16M6 5c0 6 6 10 6 10" stroke="#10b981" strokeWidth="1.6"/>
              <path d="M14 9h4l-4 6" stroke="#10b981" strokeWidth="1.6"/>
            </svg>
          }
        />
      </Card>

      {/* Logout */}
      <button
        className="w-full mt-6 px-4 py-3 rounded-2xl bg-white text-[#ef4444] font-semibold hover:shadow"
        style={{ border: "1px solid #fee2e2" }}
        onClick={() => alert("Logout (wire later)")}
        type="button"
      >
        Logout
      </button>
    </div>
  );
}
