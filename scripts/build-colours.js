// Turns your data/colours.csv into public/colours.json so the screen can show
// the little colour squares. Run once after you drop your CSV in:
//    node scripts/build-colours.js
const fs = require("fs");
const path = require("path");

const csv = path.join(__dirname, "..", "data", "colours.csv");
const out = path.join(__dirname, "..", "public", "colours.json");

const text = fs.readFileSync(csv, "utf8");
const map = {};
for (const line of text.split(/\r?\n/)) {
  if (!line.trim()) continue;
  const [code, hex] = line.split(",");
  if (!code || !hex) continue;
  if (code.trim().toLowerCase() === "code") continue;
  const norm = code.trim().toUpperCase().replace(/^FA\s*/, "FA ");
  map[norm] = hex.trim();
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(map));
console.log(`Wrote ${Object.keys(map).length} colours to public/colours.json`);
