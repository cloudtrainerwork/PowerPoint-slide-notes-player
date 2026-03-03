import { useState, useRef, useEffect, useCallback } from "react";
import JSZip from "jszip";

function extractTextParagraphs(bodyXml) {
  const paragraphs = [];
  const pMatches = bodyXml.match(/<a:p[\s>][\s\S]*?<\/a:p>/g);
  if (!pMatches) return "";
  for (const p of pMatches) {
    const runs = p.match(/<a:t>([^<]*)<\/a:t>/g);
    if (runs) {
      const text = runs.map((r) => r.replace(/<\/?a:t>/g, "")).join("");
      if (text.trim()) paragraphs.push(text.trim());
    }
  }
  return paragraphs.join("\n").trim();
}

async function parsePptx(file) {
  const zip = await JSZip.loadAsync(file);
  const slides = [];
  let i = 1;
  while (true) {
    const slideFile = zip.file(`ppt/slides/slide${i}.xml`);
    if (!slideFile) break;
    const slideXml = await slideFile.async("string");
    const textNodes = slideXml.match(/<a:t>([^<]*)<\/a:t>/g);
    const slideText = textNodes ? textNodes.map((t) => t.replace(/<\/?a:t>/g, "")).join(" ").trim() : "";
    let title = `Slide ${i}`;
    const titleMatch = slideXml.match(/type="(?:title|ctrTitle)"[\s\S]*?<a:t>([\s\S]*?)<\/a:t>/);
    if (titleMatch) title = titleMatch[1].trim();
    let notes = "";
    let imageData = null;
    const slideRelsFile = zip.file(`ppt/slides/_rels/slide${i}.xml.rels`);
    if (slideRelsFile) {
      const slideRelsXml = await slideRelsFile.async("string");
      const notesRelMatch = slideRelsXml.match(/Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/);
      if (notesRelMatch) {
        const notesFile = zip.file(`ppt/notesSlides/${notesRelMatch[1]}`);
        if (notesFile) {
          const notesXml = await notesFile.async("string");
          const shapes = notesXml.match(/<p:sp>[\s\S]*?<\/p:sp>/g);
          if (shapes) {
            for (const shape of shapes) {
              if (!/type\s*=\s*"body"/.test(shape)) continue;
              const bodyMatch = shape.match(/<p:txBody>[\s\S]*?<\/p:txBody>/);
              if (bodyMatch) {
                const extracted = extractTextParagraphs(bodyMatch[0]);
                if (extracted && !/^\d+$/.test(extracted)) { notes = extracted; break; }
              }
            }
          }
        }
      }
      const imgMatch = slideRelsXml.match(/Target="\.\.\/media\/(image[^"]+\.(png|jpg|jpeg|gif|svg))"/i);
      if (imgMatch) {
        const imgFile = zip.file(`ppt/media/${imgMatch[1]}`);
        if (imgFile) { const blob = await imgFile.async("blob"); imageData = URL.createObjectURL(blob); }
      }
    }
    slides.push({ index: i, title, slideText, notes, imageData });
    i++;
  }
  return slides;
}

function getReadableText(slide, mode) {
  if (mode === "notes") return slide.notes || "";
  if (mode === "slides") return slide.slideText || "";
  const parts = [];
  if (slide.slideText) parts.push(slide.slideText);
  if (slide.notes) parts.push(slide.notes);
  return parts.join(". . . ");
}

function hasReadableContent(slide, mode) {
  return getReadableText(slide, mode).length > 0;
}

function useTTS() {
  const [speaking, setSpeaking] = useState(null);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [rate, setRate] = useState(1.0);
  useEffect(() => {
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      setVoices(v);
      if (v.length && !selectedVoice) {
        const english = v.find((x) => x.lang.startsWith("en") && x.localService);
        setSelectedVoice(english || v[0]);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);
  const speak = useCallback((text, slideIndex) => {
    window.speechSynthesis.cancel();
    if (!text) return;
    const u = new SpeechSynthesisUtterance(text);
    if (selectedVoice) u.voice = selectedVoice;
    u.rate = rate;
    u.onend = () => setSpeaking(null);
    u.onerror = () => setSpeaking(null);
    setSpeaking(slideIndex);
    window.speechSynthesis.speak(u);
  }, [selectedVoice, rate]);
  const stop = useCallback(() => { window.speechSynthesis.cancel(); setSpeaking(null); }, []);
  return { speaking, speak, stop, voices, selectedVoice, setSelectedVoice, rate, setRate };
}

const C = {
  bg: "#0e0f13", surface: "#17181e", surfaceHover: "#1e2028",
  border: "#2a2c36", accent: "#6c63ff", accentGlow: "rgba(108,99,255,0.25)",
  text: "#e4e4e9", textMuted: "#8b8d9a", danger: "#ff5c5c",
};

function ModeToggle({ mode, setMode }) {
  const modes = [
    { key: "notes", label: "Notes" },
    { key: "slides", label: "Slides" },
    { key: "both", label: "Both" },
  ];
  return (
    <div style={{ display: "inline-flex", borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}`, background: C.bg }}>
      {modes.map((m) => (
        <button key={m.key} onClick={() => setMode(m.key)} style={{
          padding: "7px 16px", border: "none", fontSize: 12, fontWeight: 600,
          fontFamily: "'Space Grotesk', sans-serif", cursor: "pointer", transition: "all 0.2s ease",
          background: mode === m.key ? C.accent : "transparent",
          color: mode === m.key ? "#fff" : C.textMuted,
        }}>
          {m.label}
        </button>
      ))}
    </div>
  );
}

function SlideCard({ slide, mode, isPlaying, onPlay, onStop }) {
  const [expanded, setExpanded] = useState(false);
  const hasContent = hasReadableContent(slide, mode);
  let previewLabel = "";
  let previewText = "";
  if (mode === "notes") {
    previewLabel = slide.notes ? "Notes" : "";
    previewText = slide.notes || "";
  } else if (mode === "slides") {
    previewLabel = slide.slideText ? "Slide text" : "";
    previewText = slide.slideText || "";
  } else {
    const parts = [];
    if (slide.slideText) parts.push({ label: "Slide", text: slide.slideText });
    if (slide.notes) parts.push({ label: "Notes", text: slide.notes });
    previewLabel = parts.map((p) => p.label).join(" + ");
    previewText = parts.map((p) => p.text).join("\n---\n");
  }
  return (
    <div style={{
      background: C.surface, border: `1px solid ${isPlaying ? C.accent : C.border}`,
      borderRadius: 14, overflow: "hidden", transition: "all 0.3s ease",
      boxShadow: isPlaying ? `0 0 24px ${C.accentGlow}, 0 4px 20px rgba(0,0,0,0.4)` : "0 2px 12px rgba(0,0,0,0.3)",
      transform: isPlaying ? "scale(1.01)" : "scale(1)",
    }}>
      <div style={{
        height: 160, background: slide.imageData ? `url(${slide.imageData}) center/cover` : "linear-gradient(135deg, #1a1b24 0%, #262838 100%)",
        display: "flex", alignItems: "center", justifyContent: "center", position: "relative", borderBottom: `1px solid ${C.border}`,
      }}>
        {!slide.imageData && (
          <div style={{ color: C.textMuted, fontSize: 13, textAlign: "center", padding: "0 20px", lineHeight: 1.6, maxHeight: 120, overflow: "hidden", fontFamily: "'JetBrains Mono', monospace" }}>
            {slide.slideText?.slice(0, 200) || "No text content"}
          </div>
        )}
        <div style={{ position: "absolute", top: 10, left: 12, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, color: C.text, fontFamily: "'JetBrains Mono', monospace" }}>
          {String(slide.index).padStart(2, "0")}
        </div>
        {isPlaying && (
          <div style={{ position: "absolute", top: 10, right: 12, display: "flex", gap: 3, alignItems: "flex-end", height: 18 }}>
            {[0, 1, 2, 3].map((b) => (
              <div key={b} style={{ width: 3, borderRadius: 2, background: C.accent, animation: `eqBar 0.8s ease-in-out ${b * 0.15}s infinite alternate` }} />
            ))}
          </div>
        )}
      </div>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6, fontFamily: "'Space Grotesk', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {slide.title}
        </div>
        {hasContent ? (
          <>
            {previewLabel && (
              <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
                {previewLabel}
              </div>
            )}
            <div onClick={() => setExpanded(!expanded)} style={{
              fontSize: 12, color: C.textMuted, lineHeight: 1.55, cursor: "pointer",
              fontFamily: "'IBM Plex Sans', sans-serif", maxHeight: expanded ? 300 : 42,
              overflow: expanded ? "auto" : "hidden", transition: "max-height 0.3s ease", whiteSpace: "pre-line",
            }}>
              {previewText}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic", opacity: 0.5, fontFamily: "'IBM Plex Sans', sans-serif" }}>
            No content for this mode
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <button onClick={() => (isPlaying ? onStop() : onPlay())} disabled={!hasContent} style={{
            width: "100%", padding: "9px 0", borderRadius: 8, border: "none",
            background: isPlaying ? C.danger : hasContent ? C.accent : C.border,
            color: hasContent ? "#fff" : C.textMuted, fontSize: 12, fontWeight: 700,
            cursor: hasContent ? "pointer" : "default", fontFamily: "'Space Grotesk', sans-serif",
            letterSpacing: "0.04em", transition: "all 0.2s ease",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            {isPlaying ? (<><span style={{ fontSize: 14 }}>■</span> STOP</>) : (<><span style={{ fontSize: 14 }}>▶</span> PLAY</>)}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [playAllActive, setPlayAllActive] = useState(false);
  const [mode, setMode] = useState("notes");
  const playAllRef = useRef(false);
  const tts = useTTS();
  const [showSettings, setShowSettings] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setFileName(file.name);
    try { setSlides(await parsePptx(file)); } catch (err) { console.error(err); alert("Failed: " + err.message); }
    setLoading(false);
  };

  const playAll = useCallback(async () => {
    playAllRef.current = true; setPlayAllActive(true);
    for (const slide of slides.filter((s) => hasReadableContent(s, mode))) {
      if (!playAllRef.current) break;
      const text = getReadableText(slide, mode);
      await new Promise((resolve) => {
        const u = new SpeechSynthesisUtterance(text);
        if (tts.selectedVoice) u.voice = tts.selectedVoice;
        u.rate = tts.rate; u.onend = resolve; u.onerror = resolve;
        window.speechSynthesis.speak(u);
      });
    }
    setPlayAllActive(false); playAllRef.current = false;
  }, [slides, tts.selectedVoice, tts.rate, mode]);

  const stopAll = useCallback(() => { playAllRef.current = false; setPlayAllActive(false); tts.stop(); }, [tts]);
  const readableCount = slides.filter((s) => hasReadableContent(s, mode)).length;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;700&display=swap');
        @keyframes eqBar { 0% { height: 4px; } 100% { height: 16px; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      <div style={{ padding: "24px 32px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ display: "inline-flex", width: 32, height: 32, background: `linear-gradient(135deg, ${C.accent}, #9b59b6)`, borderRadius: 8, alignItems: "center", justifyContent: "center", fontSize: 16 }}>🔊</span>
            Slide Notes Player
          </h1>
          {fileName && (
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
              {fileName} — {slides.length} slides — {readableCount} playable ({mode})
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {slides.length > 0 && (
            <>
              <ModeToggle mode={mode} setMode={setMode} />
              <label style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>
                ↻ New File<input type="file" accept=".pptx" onChange={handleFile} style={{ display: "none" }} />
              </label>
              <button onClick={() => setShowSettings(!showSettings)} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: showSettings ? C.surfaceHover : "transparent", color: C.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>⚙ Voice</button>
              <button onClick={playAllActive ? stopAll : playAll} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: playAllActive ? C.danger : `linear-gradient(135deg, ${C.accent}, #9b59b6)`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>
                {playAllActive ? "■ STOP ALL" : "▶ PLAY ALL"}
              </button>
            </>
          )}
        </div>
      </div>

      {showSettings && (
        <div style={{ padding: "16px 32px", borderBottom: `1px solid ${C.border}`, background: C.surface, display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap", animation: "fadeUp 0.25s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>Voice:</label>
            <select value={tts.selectedVoice?.name || ""} onChange={(e) => { const v = tts.voices.find((x) => x.name === e.target.value); if (v) tts.setSelectedVoice(v); }}
              style={{ background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 10px", fontSize: 12, maxWidth: 260 }}>
              {tts.voices.map((v) => (<option key={v.name} value={v.name}>{v.name} ({v.lang})</option>))}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>Speed: {tts.rate.toFixed(1)}x</label>
            <input type="range" min="0.5" max="2" step="0.1" value={tts.rate} onChange={(e) => tts.setRate(parseFloat(e.target.value))} style={{ width: 120, accentColor: C.accent }} />
          </div>
        </div>
      )}

      {slides.length === 0 && !loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh", padding: 32 }}>
          <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 420, height: 280, border: `2px dashed ${C.border}`, borderRadius: 20, cursor: "pointer", background: C.surface }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.background = C.surfaceHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface; }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.8 }}>📎</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 6 }}>Drop your .pptx file here</div>
            <div style={{ fontSize: 13, color: C.textMuted }}>or click to browse</div>
            <input type="file" accept=".pptx" onChange={handleFile} style={{ display: "none" }} />
          </label>
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", fontSize: 15, color: C.textMuted, animation: "pulse 1.2s ease infinite" }}>Parsing slides...</div>
      )}

      {slides.length > 0 && (
        <div style={{ padding: "28px 32px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
          {slides.map((slide, idx) => (
            <div key={slide.index} style={{ animation: `fadeUp 0.4s ease ${idx * 0.05}s both` }}>
              <SlideCard slide={slide} mode={mode} isPlaying={tts.speaking === slide.index}
                onPlay={() => tts.speak(getReadableText(slide, mode), slide.index)} onStop={() => tts.stop()} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
