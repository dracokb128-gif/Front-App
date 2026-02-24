// src/Loader/LoaderProvider.jsx
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const LoaderCtx = createContext(null);

const DEFAULT_DELAY_MS = 150;
const DEFAULT_MIN_MS   = 700;
const MAX_VISIBLE_MS   = 3000; // safety cap: kabhi 3s se zyada ghoomna nahi chahiye

export function LoaderProvider({ children }) {
  const [visible, setVisible] = useState(false);

  const active     = useRef(0);
  const delayT     = useRef(null);
  const hideT      = useRef(null);
  const safetyT    = useRef(null);
  const minUntil   = useRef(0);

  function clearTimers() {
    if (delayT.current) { clearTimeout(delayT.current); delayT.current = null; }
    if (hideT.current)  { clearTimeout(hideT.current);  hideT.current  = null; }
    if (safetyT.current){ clearTimeout(safetyT.current);safetyT.current= null; }
  }

  function armSafety() {
    if (safetyT.current) clearTimeout(safetyT.current);
    safetyT.current = setTimeout(() => {
      // hard stop (kisi bhi mismatch ki surat me)
      active.current = 0;
      setVisible(false);
      // console.warn("[Loader] safety hide fired");
    }, MAX_VISIBLE_MS);
  }

  const api = useMemo(() => ({
    show(opts = {}) {
      const delay = Number.isFinite(opts.delay) ? opts.delay : DEFAULT_DELAY_MS;
      const min   = Number.isFinite(opts.min)   ? opts.min   : DEFAULT_MIN_MS;

      active.current += 1;

      if (visible) {
        minUntil.current = Math.max(minUntil.current, Date.now() + min);
        armSafety();
        return;
      }

      clearTimers();
      delayT.current = setTimeout(() => {
        setVisible(true);
        minUntil.current = Date.now() + min;
        armSafety();
      }, Math.max(0, delay));
    },

    hide() {
      if (active.current > 0) active.current -= 1;
      if (active.current > 0) return;

      const left = Math.max(0, minUntil.current - Date.now());
      clearTimers();
      hideT.current = setTimeout(() => {
        setVisible(false);
      }, left || 120);
    },

    bump(ms = DEFAULT_MIN_MS) {
      // 1 quick cycle
      api.show({ delay: 0, min: ms });
      api.hide();
    },

    // ---- DEBUG helpers ----
    _dump() {
      return {
        visible,
        active: active.current,
        minLeft: Math.max(0, minUntil.current - Date.now())
      };
    },
    _forceHide() {
      active.current = 0;
      clearTimers();
      setVisible(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [visible]);

  useEffect(() => {
    window.__loader = api;
    return () => {
      if (window.__loader === api) delete window.__loader;
      clearTimers();
    };
  }, [api]);

  const overlay = visible ? (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 2147483647,
        background: "rgba(15,23,42,.35)", backdropFilter: "blur(1px)",
        display: "flex", alignItems: "center", justifyContent: "center"
      }}
      onClick={e => e.stopPropagation()} // overlay click se dobara "click" events bubble na hon
    >
      <div className="loader" />
    </div>
  ) : null;

  return (
    <LoaderCtx.Provider value={api}>
      {children}
      {createPortal(overlay, document.body)}
    </LoaderCtx.Provider>
  );
}

export function useSmartLoader() { return useContext(LoaderCtx); }
export const useLoader = useSmartLoader;
