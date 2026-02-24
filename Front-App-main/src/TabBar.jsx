// src/TabBar.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { FiHome, FiHeadphones, FiMenu, FiActivity, FiUser } from "react-icons/fi";

const TABS = [
  { key: "Home",   Icon: FiHome },
  { key: "Servie",Icon: FiHeadphones },
  { key: "Menu",   Icon: FiMenu },
  { key: "Record", Icon: FiActivity },
  { key: "Mine",   Icon: FiUser },
];

export default function TabBar({ active = "Mine", onChange = () => {} }) {
  const nav = useNavigate();                 // ✅ yeh zaroori hai

  return (
    <nav className="pro-tabbar" role="tablist" aria-label="Bottom navigation">
      {TABS.map(({ key, Icon }) => (
        <button
          key={key}
          type="button"
          className={`tab ${active === key ? "is-active" : ""}`}
          aria-selected={active === key}
          onClick={() => {
            if (key === "Record") {          // ✅ Record par seedha /record khol do
              nav("/record");
              return;
            }
            onChange(key);                    // baaqi tabs pe purana behavior
          }}
        >
          <Icon className="ico" aria-hidden="true" />
          <span className="lbl">{key}</span>
        </button>
      ))}
      <div className="safe-area" />
    </nav>
  );
}
