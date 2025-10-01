import React from "react";
import { FiHome, FiHeadphones, FiMenu, FiFileText, FiUser } from "react-icons/fi";

export default function TabBar({ active, onChange }) {
  const Item = ({ icon: Icon, label }) => (
    <button
      className={`btab ${active === label ? "on" : ""}`}
      aria-label={label}
      onClick={() => onChange(label)}
    >
      <Icon className="ico" />
      <span className="lbl">{label}</span>
    </button>
  );

  return (
    <nav className="bottom">
      <Item icon={FiHome} label="Home" />
      <Item icon={FiHeadphones} label="Servic" />
      <Item icon={FiMenu} label="Menu" />
      <Item icon={FiFileText} label="Record" />
      <Item icon={FiUser} label="Mine" />
    </nav>
  );
}
