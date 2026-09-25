// THE EARS + BRAIN (backend, keys hidden here).
import { GoogleGenerativeAI } from "@google/generative-ai";
import { codeListForPrompt } from "../../../lib/colours";
import { buildBrainPrompt } from "../../../lib/brainPrompt";

export const runtime = "nodejs";
export const maxDuration = 60;

// Tries current model names in order; uses the first that works.
const MODELS = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-pro"];

export async function POST(req) {
  try {
    const { audioBase64, mimeType, currentCard } = await req.json();
    if (!audioBase64) {
      return Response.json({ error: "No audio received." }, { status: 400 });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return Response.json({ error: "Server is missing the Gemini key." }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(key);
    const prompt = buildBrainPrompt(codeListForPrompt(), currentCard || {});

    let lastErr = "";
    for (const modelName of MODELS) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        });
        const result = await model.generateContent([
          { text: prompt },
          { inlineData: { mimeType: mimeType || "audio/webm", data: audioBase64 } },
        ]);
        const text = result.response.text();
        let parsed;
        try { parsed = JSON.parse(text); }
        catch { const m = text.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); }
        if (parsed) return Response.json(parsed);
        lastErr = "Model replied but not in the expected format.";
      } catch (e) {
        lastErr = (e && e.message) ? e.message : String(e);
      }
    }
    // Show the REAL error so we can see what Google is saying.
    return Response.json({ error: "Brain failed: " + lastErr }, { status: 502 });
  } catch (e) {
    return Response.json({ error: e.message || "Brain failed." }, { status: 500 });
  }
}
