import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function NavBump({ min = 600 }) {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.__loader?.bump(min);
  }, [pathname, search, min]);
  return null;
}
