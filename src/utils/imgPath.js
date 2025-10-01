// src/utils/imgPath.js
const PUB = (typeof process !== "undefined" && process.env && process.env.PUBLIC_URL) || "";

export function fixImagePath(p) {
  if (!p) return "";
  let s = String(p).trim();

  // common typos
  s = s.replace(/\.webp\.webp$/i, ".webp")
       .replace(/\.web\.jpg$/i, ".jpg")
       .replace(/\.webp\.jpg$/i, ".webp")
       .replace(/\.web$/i, ".webp");

  // ensure PUBLIC_URL prefix for /products/*
  if (s.startsWith("/")) s = PUB + s;
  return s;
}

// local images that we KNOW exist
export const FALLBACKS = [
  "/products/1.jpg","/products/2.jpg","/products/3.jpg",
  "/products/4.webp","/products/5.webp","/products/6.webp",
  "/products/7.webp","/products/8.webp","/products/9.webp","/products/10.webp"
].map(p => PUB + p);
