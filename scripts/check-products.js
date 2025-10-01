// scripts/check-products.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const dir = path.join(ROOT, "public", "products");
const jsonFile = path.join(ROOT, "src", "data", "products.json");
const exts = ["webp", "jpg", "jpeg", "png"];

function findExisting(base) {
  for (const e of exts) {
    const p = path.join(dir, `${base}.${e}`);
    if (fs.existsSync(p)) return `/products/${base}.${e}`;
  }
  return null;
}

if (!fs.existsSync(jsonFile)) {
  console.error("Missing:", jsonFile);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(jsonFile, "utf8"));
const idSeen = new Set();
let changed = 0;
let reId = 1;

for (const it of data) {
  // Unique sequential ids if duplicates/mixed
  const nextId = String(reId++).padStart(3, "0");
  if (idSeen.has(it.id)) it.id = nextId;
  idSeen.add(it.id);

  // normalize image path + fix double extensions
  let p = (it.image || "").trim().replace(/\/{2,}/g, "/");
  p = p.replace(/\.webp\.jpe?g$/i, ".webp").replace(/\.web\.jpe?g$/i, ".jpg").replace(/\.web$/i, ".webp");

  // ensure correct extension exists on disk
  const m = p.match(/^\/products\/(.+?)(?:\.(webp|jpe?g|png))$/i);
  const base = m ? m[1] : p.replace(/^\/products\//, "").replace(/\.(?:[^.]+)$/, "");
  const resolved = findExisting(base);
  if (resolved && resolved !== p) {
    it.image = resolved;
    changed++;
  }

  // ensure title
  if (!it.title && it.name) it.title = it.name;
  if (!it.title) {
    const b = (it.image || "").replace(/^\/products\//, "").replace(/\.(png|jpe?g|webp)$/i, "");
    it.title = b.replace(/[-_]+/g, " ").trim();
  }
}

if (changed) console.log(`Fixed ${changed} image path(s).`);
fs.writeFileSync(jsonFile, JSON.stringify(data, null, 2), "utf8");
console.log("Checked:", jsonFile, "Items:", data.length);
