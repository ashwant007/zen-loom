"use client";
import { useEffect, useRef, useState } from "react";

export default function ZEN() {
  const [colours, setColours] = useState({});
  const [card, setCard] = useState({ loom_no: "", weaver: "", design_code: "", columns: [], rows: [], doubts: [], status: "draft" });
  const [log, setLog] = useState([]);
  const [phase, setPhase] = useState("idle");
  const [soundOn, setSoundOn] = useState(true);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const acRef = useRef(null);

  useEffect(() => {
    fetch("/colours.json").then(r => r.ok ? r.json() : {}).then(setColours).catch(() => {});
  }, []);

  function beep(kind) {
    if (!soundOn) return;
    try {
      const ac = acRef.current || (acRef.current = new (window.AudioContext || window.webkitAudioContext)());
      const t = ac.currentTime;
      const notes = { wake: [520, 780], land: [900], row: [600, 760], save: [520, 660, 880], attn: [430, 560] }[kind] || [700];
      notes.forEach((f, i) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = f; o.type = "sine";
        g.gain.setValueAtTime(0, t + i * 0.09);
        g.gain.linearRampToValueAtTime(0.05, t + i * 0.09 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.35);
        o.connect(g).connect(ac.destination); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.37);
      });
    } catch {}
  }

  function addLog(who, text, typed) { setLog(l => [...l, { who, text, typed }]); }

  async function speak(text) {
    addLog("zen", text);
    setPhase("speaking");
    try {
      const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      if (r.ok) {
        const buf = await r.arrayBuffer();
        if (buf.byteLength > 0) {
          const url = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
          const a = new Audio(url); await a.play().catch(() => {});
        }
      }
    } catch {}
    setPhase("idle");
  }

  async function toggleRecord() {
    if (phase === "recording") {
      setPhase("thinking");
      mediaRef.current && mediaRef.current.stop();
      return;
    }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { addLog("zen", "I can't reach the microphone. Please allow mic access, or type below."); return; }
    chunksRef.current = [];
    const mr = new MediaRecorder(stream);
    mediaRef.current = mr;
    mr.ondataavailable = e => e.data.size && chunksRef.current.push(e.data);
    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || "audio/webm" });
      await sendAudio(blob);
    };
    mr.start(); setPhase("recording"); beep("wake");
    if (log.length === 0) addLog("zen", "Loom number and weaver name?");
  }

  async function sendAudio(blob) {
    setPhase("thinking");
    const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });
    try {
      const r = await fetch("/api/brain", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64: b64, mimeType: blob.type, currentCard: card }),
      });
      const d = await r.json();
      if (d.error) { addLog("zen", d.error); setPhase("idle"); return; }
      applyBrain(d, false);
    } catch (e) { addLog("zen", "Network problem reaching the assistant."); setPhase("idle"); }
  }

  // applyBrain: fromTyped tells us NOT to re-log the dad text (typeSend already did).
  function applyBrain(d, fromTyped) {
    if (!fromTyped && d.transcript) addLog("dad", d.transcript);

    setCard(prev => {
      const next = { ...prev, columns: [...prev.columns], rows: prev.rows.map(r => ({ ...r })) };
      if (d.loom_no) next.loom_no = d.loom_no;
      if (d.weaver) next.weaver = d.weaver;
      if (d.columns && d.columns.length) {
        d.columns.forEach(c => { if (!next.columns.includes(c)) next.columns.push(c); });
      }
      if (d.rows && d.rows.length) next.rows = d.rows;
      if (d.doubts) next.doubts = d.doubts;
      return next;
    });

    if (d.columns && d.columns.length) beep("land");
    if (d.rows && d.rows.length) beep("land");
    if (d.intent === "new_row") beep("row");

    if (d.intent === "save") { handleSave(); return; }

    if (d.doubts && d.doubts.length) {
      const one = d.doubts[0];
      beep("attn");
      speak(`In row ${one.row}, ${one.column} — I wasn't sure. I heard ${one.heard}. What should it be?`);
    } else if (d.intent === "unknown") {
      addLog("zen", "I didn't catch that. Try \"FA 1476 for body\", \"next row\", or \"save\".");
    }
    setPhase("idle");
  }

  async function handleSave() {
    setPhase("thinking");
    let theCard;
    setCard(c => { theCard = c; return c; });
    await new Promise(r => setTimeout(r, 0));
    try {
      const r = await fetch("/api/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ card: theCard }) });
      const d = await r.json();
      beep("save");
      if (d.ok) { await speak(`Saved Loom ${theCard.loom_no || ""} to Google Drive.`); setCard({ loom_no: "", weaver: "", design_code: theCard.design_code, columns: [], rows: [], doubts: [], status: "draft" }); }
      else await speak("Card kept safe, but couldn't reach Google Drive: " + (d.driveError || "unknown"));
    } catch { await speak("I couldn't save just now. The card is kept safe."); }
    setPhase("idle");
  }

  function typeSend(e) {
    e.preventDefault();
    const v = e.target.msg.value.trim(); if (!v) return; e.target.msg.value = "";
    addLog("dad", v, true);
    setPhase("thinking");
    fetch("/api/brain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentCard: card, typedText: v }) })
      .then(r => r.json())
      .then(d => {
        if (d.error) { addLog("zen", d.error); setPhase("idle"); return; }
        applyBrain(d, true);
      })
      .catch(() => { addLog("zen", "Network problem. Try again."); setPhase("idle"); });
  }

  const recording = phase === "recording";

  return (
    <main style={S.page}>
      <header style={S.top}>
        <div style={S.brand}><span style={S.ring} /><b>ZEN</b></div>
        <span style={S.chip}>Design <b>{card.design_code || "—"}</b></span>
        <div style={{ flex: 1 }} />
        <button style={S.icon} onClick={() => setSoundOn(s => !s)} title="Sound">{soundOn ? "🔊" : "🔈"}</button>
      </header>

      <section style={S.sheetWrap}>
        {card.columns.length === 0 ? (
          <div style={S.emptyHint}>Tap the orb, or type below — columns appear here as they're named.</div>
        ) : (
          <table style={S.table}>
            <thead><tr>{card.columns.map(c => <th key={c} style={S.th}>{c}</th>)}</tr></thead>
            <tbody>
              {(card.rows.length ? card.rows : [{}]).map((row, ri) => (
                <tr key={ri}>
                  {card.columns.map(c => {
                    const cell = row[c];
                    const code = cell?.code;
                    const hex = code && colours[code];
                    return (
                      <td key={c} style={{ ...S.td, ...(cell && !cell.recognised ? S.tdDoubt : {}) }}>
                        {code ? (
                          <span style={S.codeCell}>
                            <span style={{ ...S.sw, background: hex || "transparent", borderStyle: hex ? "solid" : "dashed" }} />
                            {code}{!cell.recognised && <em style={S.flag}>· check</em>}
                          </span>
                        ) : <span style={S.blank}>—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={S.dock}>
        <div style={S.logPanel}>
          <div style={S.logTitle}>Conversation</div>
          <div style={S.log}>
            {log.map((b, i) => (
              <div key={i} style={{ ...S.bubble, ...(b.who === "zen" ? S.zen : S.dad) }}>
                <span style={S.tag}>{b.who === "zen" ? "ZEN" : "Dad"}{b.typed ? " · typed" : ""}</span>{b.text}
              </div>
            ))}
          </div>
          <form onSubmit={typeSend} style={S.typebar}>
            <input name="msg" placeholder="Type: FA 1476 for body, next row, save…" style={S.typeInput} autoComplete="off" />
            <button style={S.send} type="submit">➤</button>
          </form>
        </div>

        <div style={S.orbPanel}>
          <button onClick={toggleRecord} style={{ ...S.orb, ...(recording ? S.orbRec : {}) }} aria-label="Tap to speak">
            {phase === "thinking" ? "…" : "🎙"}
          </button>
          <div style={S.orbLine}>
            {phase === "recording" ? "Listening… tap to stop" : phase === "thinking" ? "Thinking…" : phase === "speaking" ? "ZEN is speaking" : "Tap to speak"}
          </div>
        </div>

        <div style={S.cardPanel}>
          <div style={S.logTitle}>This card</div>
          <div style={S.field}><label style={S.lab}>Loom No.</label><div style={S.val}>{card.loom_no || "—"}</div></div>
          <div style={S.field}><label style={S.lab}>Weaver</label><div style={S.val}>{card.weaver || "—"}</div></div>
          <div style={S.field}><label style={S.lab}>Headings</label><div style={S.valSmall}>{card.columns.join(", ") || "None yet"}</div></div>
          <button style={S.saveBtn} onClick={handleSave}>Save to Drive</button>
        </div>
      </section>
    </main>
  );
}

const S = {
  page: { minHeight: "100vh", background: "#070B0C", color: "#E7F1EF", fontFamily: "'Bricolage Grotesque','Noto Sans Tamil',system-ui,sans-serif", display: "flex", flexDirection: "column" },
  top: { display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: "1px solid #1B2A2B" },
  brand: { display: "flex", alignItems: "center", gap: 8, fontSize: 19, fontWeight: 800 },
  ring: { width: 22, height: 22, borderRadius: "50%", background: "conic-gradient(from 200deg,#2FD8C4,transparent 60%)" },
  chip: { padding: "5px 11px", borderRadius: 999, background: "#111C1E", border: "1px solid #1B2A2B", fontSize: 13, fontWeight: 700, color: "#7E9694" },
  icon: { width: 38, height: 38, borderRadius: 10, border: "1px solid #1B2A2B", background: "#111C1E", fontSize: 17, cursor: "pointer" },
  sheetWrap: { margin: "14px 18px", background: "#0D1517", border: "1px solid #1B2A2B", borderRadius: 14, overflow: "auto", maxHeight: "34vh", boxShadow: "0 12px 30px rgba(0,0,0,.5)" },
  emptyHint: { padding: 28, textAlign: "center", color: "#7E9694", fontSize: 15 },
  table: { borderCollapse: "collapse", width: "100%", minWidth: 420 },
  th: { padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#7E9694", textTransform: "uppercase", letterSpacing: ".02em", borderBottom: "1px solid #28393A", background: "#111C1E", borderLeft: "1px solid #1B2A2B" },
  td: { padding: "10px 14px", fontSize: 16, fontWeight: 600, borderBottom: "1px solid #1B2A2B", borderLeft: "1px solid #1B2A2B" },
  tdDoubt: { background: "rgba(239,178,92,.14)", boxShadow: "inset 0 0 0 1.5px #EFB25C" },
  codeCell: { display: "inline-flex", alignItems: "center", gap: 8 },
  sw: { width: 16, height: 16, borderRadius: 4, border: "1px solid rgba(255,255,255,.2)", flex: "none" },
  flag: { color: "#EFB25C", fontSize: 12, fontWeight: 700, fontStyle: "normal" },
  blank: { color: "#7E9694", fontWeight: 400 },
  dock: { flex: 1, display: "grid", gridTemplateColumns: "1.2fr .8fr 1fr", gap: 12, padding: "0 18px 16px" },
  logPanel: { background: "#0D1517", border: "1px solid #1B2A2B", borderRadius: 14, padding: 12, display: "flex", flexDirection: "column", minHeight: 0 },
  logTitle: { fontSize: 12, fontWeight: 700, color: "#7E9694", textTransform: "uppercase", letterSpacing: ".03em", marginBottom: 8 },
  log: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, minHeight: 120 },
  bubble: { maxWidth: "88%", padding: "8px 12px", borderRadius: 13, fontSize: 14.5, lineHeight: 1.4 },
  zen: { alignSelf: "flex-start", background: "#111C1E", border: "1px solid #1B2A2B", borderBottomLeftRadius: 4 },
  dad: { alignSelf: "flex-end", background: "rgba(47,216,196,.14)", borderBottomRightRadius: 4, color: "#E7F1EF" },
  tag: { display: "block", fontSize: 11, fontWeight: 700, color: "#7E9694", marginBottom: 2 },
  typebar: { display: "flex", gap: 8, marginTop: 8 },
  typeInput: { flex: 1, height: 42, borderRadius: 11, border: "1px solid #1B2A2B", background: "#111C1E", color: "#E7F1EF", padding: "0 12px", fontSize: 14.5, outline: "none" },
  send: { width: 42, height: 42, borderRadius: 11, background: "#2FD8C4", color: "#04211C", border: "none", cursor: "pointer", fontSize: 16 },
  orbPanel: { background: "#0D1517", border: "1px solid #1B2A2B", borderRadius: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 16 },
  orb: { width: 90, height: 90, borderRadius: "50%", border: "none", cursor: "pointer", fontSize: 30, color: "#04211C", background: "radial-gradient(circle at 32% 26%,#6FEBDB,#2FD8C4 55%,#04302A)", boxShadow: "0 10px 30px rgba(47,216,196,.4)" },
  orbRec: { background: "radial-gradient(circle at 32% 26%,#FFB0A0,#C0392B 60%,#4A0F09)", boxShadow: "0 10px 30px rgba(192,57,43,.5)" },
  orbLine: { fontSize: 14, fontWeight: 700, color: "#7E9694", textAlign: "center" },
  cardPanel: { background: "#0D1517", border: "1px solid #1B2A2B", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column" },
  field: { marginBottom: 12 },
  lab: { display: "block", fontSize: 12, color: "#7E9694", fontWeight: 700, marginBottom: 4 },
  val: { fontSize: 20, fontWeight: 700 },
  valSmall: { fontSize: 14, fontWeight: 600 },
  saveBtn: { marginTop: "auto", height: 46, borderRadius: 11, background: "#2FD8C4", color: "#04211C", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer" },
};
