// src/Loader/GlobalBump.jsx
import { useEffect, useRef } from "react";

/**
 * Har user click par chhota pulse.
 * - capture phase pe suno (bubbling se pehle)
 * - throttle so 300–400ms me multiple clicks merge ho jayein
 * - .no-bump class waale elements ignore
 */
export default function GlobalBump({ min = 550, throttle = 350 }) {
  const last = useRef(0);

  useEffect(() => {
    const onClick = (e) => {
      // opt-out
      if (e.target.closest(".no-bump")) return;

      const now = Date.now();
      if (now - last.current < throttle) return;
      last.current = now;

      window.__loader?.bump(min);
    };

    // capture = true ⇒ sabse pehle humare paas event aata hai
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [min, throttle]);

  return null;
}
