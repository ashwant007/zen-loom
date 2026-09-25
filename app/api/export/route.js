// THE HANDS (backend, keys hidden). On "save": build a PDF that looks like the
// paper loom card (plain bordered grid, codes only), then file it into Google Drive.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export const runtime = "nodejs";
export const maxDuration = 60;

function buildPdf(card) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  doc.setFontSize(14);
  doc.text(`Design ${card.design_code || ""}`.trim(), 40, 40);
  doc.setFontSize(11);
  doc.text(`Loom No: ${card.loom_no || ""}`, 40, 60);
  doc.text(`Weaver: ${card.weaver || ""}`, 240, 60);
  doc.text(`Date: ${date}`, 440, 60);

  const cols = card.columns || [];
  const head = [cols];
  const bodyRows = (card.rows || []).map((r) =>
    cols.map((c) => (r[c] && r[c].code ? r[c].code : ""))
  );

  autoTable(doc, {
    startY: 80,
    head,
    body: bodyRows,
    theme: "grid",
    styles: { lineColor: [0, 0, 0], lineWidth: 0.7, textColor: [0, 0, 0], fontSize: 11, cellPadding: 6 },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold" },
  });

  return Buffer.from(doc.output("arraybuffer"));
}

async function uploadToDrive(pdfBuffer, filename) {
  // Uses Composio to place the file in the connected Google Drive folder.
  // Keys + folder id come from Vercel settings.
  const apiKey = process.env.COMPOSIO_API_KEY;
  const folderId = process.env.DRIVE_FOLDER_ID;
  if (!apiKey) throw new Error("Missing Composio key.");

  const { Composio } = await import("composio-core");
  const composio = new Composio({ apiKey });

  // Google Drive upload via Composio's action. The connected account was set up
  // once in the Composio dashboard, so no per-use login is needed.
  const res = await composio.actions.execute({
    actionName: "GOOGLEDRIVE_UPLOAD_FILE",
    params: {
      file_name: filename,
      file_content_base64: pdfBuffer.toString("base64"),
      parent_id: folderId || undefined,
      mime_type: "application/pdf",
    },
  });
  return res;
}

export async function POST(req) {
  try {
    const { card } = await req.json();
    if (!card) return Response.json({ error: "No card." }, { status: 400 });

    const pdf = buildPdf(card);
    const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const filename = `Loom ${card.loom_no || "-"} - ${card.weaver || "-"} - ${card.design_code || "card"} - ${date}.pdf`;

    let drive = null, driveError = null;
    try {
      drive = await uploadToDrive(pdf, filename);
    } catch (e) {
      driveError = e.message; // If Drive fails, we still tell the tablet (offline-safe handling on client).
    }

    return Response.json({ ok: !driveError, filename, driveError });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
