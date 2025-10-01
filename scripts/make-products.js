// scripts/make-products.js
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "public", "products");
const out = path.join(__dirname, "..", "src", "data", "products.json");

if (!fs.existsSync(dir)) {
  console.error("Folder not found:", dir);
  process.exit(1);
}

const files = fs
  .readdirSync(dir)
  .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const data = files.map((f, i) => ({
  id: String(i + 1).padStart(3, "0"),
  title: f.replace(/\.(png|jpe?g|webp)$/i, "").replace(/[-_]+/g, " "),
  image: "/products/" + f,
}));

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(data, null, 2), "utf8");
console.log("Created", out, "Items:", data.length);
