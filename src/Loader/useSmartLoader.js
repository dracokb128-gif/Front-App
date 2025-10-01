// src/Loader/useSmartLoader.js
import { useRef } from "react";
import { useLoader } from ".";

export default function useSmartLoader(delay = 150) {
  const { show, hide } = useLoader();
  const timer = useRef(null);

  const start = (text = "Loading…") => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => show(text), delay);
  };

  const stop = () => {
    clearTimeout(timer.current);
    timer.current = null;
    hide();
  };

  return { start, stop };
}
