// THE MOUTH (backend, key hidden). Turns ZEN's short replies into speech
// using Fish Audio, and streams the audio back to the tablet.

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { text } = await req.json();
    if (!text) return Response.json({ error: "No text." }, { status: 400 });

    const key = process.env.FISH_AUDIO_API_KEY;
    const voiceId = process.env.FISH_AUDIO_VOICE_ID;
    if (!key) return Response.json({ error: "Missing Fish Audio key." }, { status: 500 });

    const resp = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        reference_id: voiceId || undefined,
        format: "mp3",
      }),
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      return Response.json({ error: "Fish Audio error", detail: t.slice(0, 200) }, { status: 502 });
    }

    const audio = await resp.arrayBuffer();
    return new Response(audio, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
