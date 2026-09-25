import { GoogleGenerativeAI } from "@google/generative-ai";
import { loadColours, codeListForPrompt } from "../../../lib/colours";
import { buildBrainPrompt } from "../../../lib/brainPrompt";

export const runtime = "nodejs";
export const maxDuration = 60;
const MODELS = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3.5-flash"];

// Parse typed text like "FA 1476 for body" — accepts ANY column name.
function parseTyped(text, card) {
  const colours = loadColours();
  const low = text.toLowerCase().trim();
  if (/next row/.test(low)) return { intent: "new_row", transcript: text };
  if (/^save|save it|save this|finish/.test(low)) return { intent: "save", transcript: text };

  const loom = low.match(/loom\s*(\w+)/);
  const code = text.match(/FA\s*\d{3,4}/i);

  // column = the word after "for", else the last word that isn't the code
  let col = null;
  const forMatch = text.match(/for\s+([A-Za-z][A-Za-z0-9 ]*)$/i);
  if (forMatch) col = forMatch[1].trim();
  if (!col) {
    const words = text.replace(/FA\s*\d{3,4}/i, "").trim().split(/\s+/).filter(Boolean);
    if (words.length) col = words[words.length - 1];
  }
  if (col) col = col.charAt(0).toUpperCase() + col.slice(1);

  const out = { intent: "fill", transcript: text, columns: card.columns || [], rows: card.rows || [] };
  if (loom) { out.intent = "set_meta"; out.loom_no = loom[1]; }

  if (code && col) {
    const norm = code[0].toUpperCase().replace(/^FA\s*/, "FA ");
    if (!out.columns.includes(col)) out.columns = [...out.columns, col];
    const rows = out.rows.length ? out.rows : [{}];
    rows[rows.length - 1] = { ...rows[rows.length - 1], [col]: { code: norm, recognised: !!colours[norm] } };
    out.rows = rows;
    if (!colours[norm]) out.doubts = [{ row: rows.length, column: col, heard: norm, reason: "not in list" }];
    return out;
  }
  if (loom) return out;
  return { intent: "unknown", transcript: text };
}

export async function POST(req) {
  try {
    const { audioBase64, mimeType, currentCard, typedText } = await req.json();
    const card = currentCard || {};

    if (typedText) return Response.json(parseTyped(typedText, card));

    if (!audioBase64) return Response.json({ error: "No audio received." }, { status: 400 });
    const key = process.env.GEMINI_API_KEY;
    if (!key) return Response.json({ error: "Server is missing the Gemini key." }, { status: 500 });

    const genAI = new GoogleGenerativeAI(key);
    const prompt = buildBrainPrompt(codeListForPrompt(), card);
    let lastErr = "";
    for (const m of MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: m, generationConfig: { temperature: 0, responseMimeType: "application/json" } });
        const r = await model.generateContent([{ text: prompt }, { inlineData: { mimeType: mimeType || "audio/webm", data: audioBase64 } }]);
        const t = r.response.text();
        let p; try { p = JSON.parse(t); } catch { const mm = t.match(/\{[\s\S]*\}/); if (mm) p = JSON.parse(mm[0]); }
        if (p) return Response.json(p);
      } catch (e) { lastErr = e.message || String(e); }
    }
    return Response.json({ error: "Brain failed: " + lastErr }, { status: 502 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
