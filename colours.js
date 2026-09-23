// Loads the full FA colour code list from data/colours.csv.
// You drop YOUR real CSV (Code,Hex Code) into the /data folder — this reads it.
// Every code becomes both a swatch on screen and a spell-check for the ears.

import fs from "fs";
import path from "path";

let cache = null;

export function loadColours() {
  if (cache) return cache;
  const file = path.join(process.cwd(), "data", "colours.csv");
  const map = {};
  try {
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      const [code, hex] = line.split(",");
      if (!code || !hex) continue;
      if (code.trim().toLowerCase() === "code") continue; // header
      const norm = code.trim().toUpperCase().replace(/^FA\s*/, "FA ");
      map[norm] = hex.trim();
    }
  } catch (e) {
    console.error("Could not read data/colours.csv:", e.message);
  }
  cache = map;
  return map;
}

// A compact string of all codes, handed to the ears so it stops guessing.
export function codeListForPrompt() {
  return Object.keys(loadColours()).join(", ");
}
