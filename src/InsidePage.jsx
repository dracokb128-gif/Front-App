// src/InsidePage.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { logout, getUser } from "./auth";

// 👉 yeh import zaroor chahiye taake task UI yahin render ho
import MenuPage from "./MenuPage";

export default function InsidePage() {
  const nav = useNavigate();
  const user = getUser();

  const doLogout = () => {
    logout();
    nav("/login", { replace: true });
  };

  return (
    <div className="inside-wrap">
      {/* Top bar same as before */}
      <div className="inside-topbar">
        <div className="inside-brand">✅ Logged in</div>
        <div className="inside-actions">
          <span className="inside-user">Hi, {user}</span>
          <button className="logout-btn" onClick={doLogout}>Logout</button>
        </div>
      </div>

      {/* 👇 Yahan direct MenuPage render kar rahe hain
          Iske andar Amazon detail + combine popup + manual submit guard sab hai */}
      <main className="inside-main">
        <MenuPage />
      </main>
    </div>
  );
}
