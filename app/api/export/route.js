// THE HANDS (backend, keys hidden). On "save": build a PDF that looks like the
// paper loom card (plain bordered grid, codes only), then file it into Google Drive
// directly, using a Google OAuth refresh token stored in Vercel settings.

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
  const bodyRows = (card.rows || []).map((r) =>
    cols.map((c) => (r[c] && r[c].code ? r[c].code : ""))
  );

  autoTable(doc, {
    startY: 80,
    head: [cols],
    body: bodyRows,
    theme: "grid",
    styles: { lineColor: [0, 0, 0], lineWidth: 0.7, textColor: [0, 0, 0], fontSize: 11, cellPadding: 6 },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold" },
  });

  return Buffer.from(doc.output("arraybuffer"));
}

async function googleAccessToken() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Google Drive credentials in server settings.");
  }
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!resp.ok) throw new Error("Could not refresh Google token.");
  const data = await resp.json();
  return data.access_token;
}

async function uploadToDrive(pdfBuffer, filename) {
  const folderId = process.env.DRIVE_FOLDER_ID;
  const token = await googleAccessToken();

  const metadata = { name: filename, mimeType: "application/pdf" };
  if (folderId) metadata.parents = [folderId];

  const boundary = "zen_boundary_" + Date.now();
  const pre =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    "Content-Type: application/pdf\r\n" +
    "Content-Transfer-Encoding: base64\r\n\r\n";
  const post = `\r\n--${boundary}--`;
  const body = Buffer.concat([
    Buffer.from(pre, "utf8"),
    Buffer.from(pdfBuffer.toString("base64"), "utf8"),
    Buffer.from(post, "utf8"),
  ]);

  const resp = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error("Drive upload failed: " + t.slice(0, 160));
  }
  return await resp.json();
}

export async function POST(req) {
  try {
    const { card } = await req.json();
    if (!card) return Response.json({ error: "No card." }, { status: 400 });

    const pdf = buildPdf(card);
    const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const filename = `Loom ${card.loom_no || "-"} - ${card.weaver || "-"} - ${card.design_code || "card"} - ${date}.pdf`;

    let driveError = null;
    try {
      await uploadToDrive(pdf, filename);
    } catch (e) {
      driveError = e.message;
    }

    return Response.json({ ok: !driveError, filename, driveError });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
