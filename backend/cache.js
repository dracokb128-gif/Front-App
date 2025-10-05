// backend/cache.js
const fs = require("fs");

const cache = new Map();

function readJSONCached(file) {
  const stat = fs.statSync(file);
  const mtime = stat.mtimeMs;
  const cached = cache.get(file);
  if (cached && cached.mtime === mtime) return cached.data;
  try {
    const txt = fs.readFileSync(file, "utf8") || "[]";
    const data = JSON.parse(txt);
    cache.set(file, { mtime, data });
    return data;
  } catch {
    return [];
  }
}

function writeJSONCached(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  cache.set(file, { mtime: Date.now(), data });
}

module.exports = { readJSONCached, writeJSONCached };
