// scripts/normalize-extensions.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "public", "products");

if (!fs.existsSync(DIR)) {
  console.error("Folder not found:", DIR);
  process.exit(1);
}

function sniff(buf) {
  // WEBP: RIFF....WEBP
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP")
    return "webp";
  // JPEG: FF D8
  if (buf[0] === 0xff && buf[1] === 0xd8) return "jpg";
  // PNG signature
  const sig = [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a];
  if (sig.every((v,i)=>buf[i]===v)) return "png";
  return null;
}

let fixed = 0;
for (const f of fs.readdirSync(DIR)) {
  const p = path.join(DIR, f);
  if (!fs.statSync(p).isFile()) continue;

  const buf = fs.readFileSync(p, { length: 16 });
  const kind = sniff(buf);
  if (!kind) continue;

  const cur = (f.match(/\.(webp|jpe?g|png)$/i) || ["",""])[1].toLowerCase();
  const want = kind === "jpg" ? "jpg" : kind;

  // already correct and not double-extension
  if (cur === want && !/\.webp\.(jpe?g)$/i.test(f)) continue;

  const base = f.replace(/\.(?:webp|jpe?g|png)$/ig, "");
  let newName = `${base}.${want}`;
  let dst = path.join(DIR, newName);
  let i = 1;
  while (fs.existsSync(dst)) {
    newName = `${base}-${i}.${want}`;
    dst = path.join(DIR, newName);
    i++;
  }
  fs.renameSync(p, dst);
  console.log("Renamed:", f, "→", newName);
  fixed++;
}
console.log(`Done. Fixed files: ${fixed}`);
console.log("Now regenerate products.json with: node scripts/make-products.js");
