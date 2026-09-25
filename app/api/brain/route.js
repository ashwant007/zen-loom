// THE EARS + BRAIN (backend, keys hidden here).
// Receives recorded audio from the tablet, sends it to Gemini with the code list,
// and returns a structured card update. The Gemini key lives in Vercel settings.

import { GoogleGenerativeAI } from "@google/generative-ai";
import { codeListForPrompt } from "../../../lib/colours";
import { buildBrainPrompt } from "../../../lib/brainPrompt";

export const runtime = "nodejs";
export const maxDuration = 60;

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
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro",
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    });

    const prompt = buildBrainPrompt(codeListForPrompt(), currentCard || {});

    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType: mimeType || "audio/webm", data: audioBase64 } },
    ]);

    const text = result.response.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }
    if (!parsed) {
      return Response.json({ error: "Could not understand the reply.", raw: text }, { status: 502 });
    }
    return Response.json(parsed);
  } catch (e) {
    return Response.json({ error: e.message || "Brain failed." }, { status: 500 });
  }
}
