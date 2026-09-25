// THE MEMORY bridge. Saves the current card after every change (so nothing is
// lost if the tablet closes) and loads it back when he returns.

import { serverClient } from "../../../lib/db";

export const runtime = "nodejs";

// Save (or update) the draft card.
export async function POST(req) {
  try {
    const { card } = await req.json();
    const db = serverClient();
    const row = {
      id: card.id || undefined,
      loom_no: card.loom_no || "",
      weaver: card.weaver || "",
      design_code: card.design_code || "",
      columns: card.columns || [],
      rows: card.rows || [],
      doubts: card.doubts || [],
      status: card.status || "draft",
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await db.from("cards").upsert(row).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ card: data });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Load the latest draft (the resume point).
export async function GET() {
  try {
    const db = serverClient();
    const { data, error } = await db
      .from("cards")
      .select("*")
      .eq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(1);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ card: data && data[0] ? data[0] : null });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
