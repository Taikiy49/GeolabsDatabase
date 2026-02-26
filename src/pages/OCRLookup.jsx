// src/pages/OCRLookup.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import Topbar from "../components/Topbar";
import { apiSend, apiUpload } from "../api/client";
import "../styles/ocr.css";

function dedupe(arr) {
  return Array.from(new Set((arr || []).map((x) => (x ?? "").trim()).filter(Boolean)));
}

function parseBullets(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.replace(/^[-•–*]\s*/, "").trim())
    .filter(Boolean);
}

function normalizeLetterSuffix(wo) {
  if (/[A-Za-z]$/.test(wo)) return `${wo.slice(0, -1)}(${wo.slice(-1).toUpperCase()})`;
  return wo;
}

// Always-on normalization (no UI toggles)
function normalizeWO(wo) {
  let s = String(wo || "");

  // strip spaces
  s = s.replace(/\s+/g, "");

  // normalize dashes
  s = s.replace(/[–—]/g, "-");

  // smart OCR fixes
  s = s
    .replace(/(?<=\d)O(?=\d)|(?<=\d)O(?![A-Za-z])/g, "0")
    .replace(/(?<=\d)[Il](?=\d)|(?<=\d)[Il](?![A-Za-z])/g, "1")
    .replace(/(?<=\d)B(?=\d)/g, "8")
    .replace(/[-_/]{2,}/g, "-");

  // uppercase
  s = s.toUpperCase();

  // normalize suffix -> (A)
  s = normalizeLetterSuffix(s);

  return s.trim();
}

export default function OCRLookup({ pushToast }) {
  const [step, setStep] = useState(1);

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [extractedWOs, setExtractedWOs] = useState([]);
  const [editedWOs, setEditedWOs] = useState([]);
  const [matches, setMatches] = useState([]);

  const [filter, setFilter] = useState("");
  const [showNotFoundOnly, setShowNotFoundOnly] = useState(false);

  const inputRef = useRef(null);
  const dropRef = useRef(null);

  function resetAll() {
    setStep(1);
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview("");
    setError("");
    setLoading(false);

    setExtractedWOs([]);
    setEditedWOs([]);
    setMatches([]);
    setFilter("");
    setShowNotFoundOnly(false);
  }

  function setFile(file) {
    if (!file) return;
    setImageFile(file);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(URL.createObjectURL(file));
    setExtractedWOs([]);
    setEditedWOs([]);
    setMatches([]);
    setStep(1);
    setError("");
  }

  // drag & drop
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;

    const prevent = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const onDrop = (e) => {
      prevent(e);
      const f = e.dataTransfer.files?.[0];
      if (f && f.type.startsWith("image/")) setFile(f);
    };

    ["dragenter", "dragover", "dragleave", "drop"].forEach((evt) =>
      el.addEventListener(evt, prevent)
    );
    el.addEventListener("drop", onDrop);

    return () => {
      ["dragenter", "dragover", "dragleave", "drop"].forEach((evt) =>
        el.removeEventListener(evt, prevent)
      );
      el.removeEventListener("drop", onDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagePreview]);

  // paste image
  useEffect(() => {
    const onPaste = (e) => {
      const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (file) setFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagePreview]);

  async function handleExtract() {
    if (!imageFile) return;
    setLoading(true);
    setError("");

    try {
      const fd = new FormData();
      fd.append("image", imageFile);

      const res = await apiUpload("/api/ocr-upload", fd);

      const rawOutput = res?.recognized_work_orders;
      let workOrders = Array.isArray(rawOutput) ? rawOutput : parseBullets(rawOutput);
      workOrders = dedupe(workOrders);

      if (!workOrders.length) {
        setError("No work orders found. Try another image.");
        return;
      }

      const normalized = workOrders.map((w) => normalizeWO(w));

      setExtractedWOs(workOrders);
      setEditedWOs(normalized);
      setStep(2);

      pushToast?.("OCR", "Extraction complete");
    } catch (e) {
      // show something useful
      const msg =
        e?.response?.data?.error ||
        e?.message ||
        "Upload or extraction failed. Please try again.";
      setError(String(msg));
      pushToast?.("Error", String(msg));
    } finally {
      setLoading(false);
    }
  }

  async function rerunLookup(nextList = editedWOs) {
    const woList = dedupe(nextList.map((w) => normalizeWO(w)));
    if (!woList.length) {
      setMatches([]);
      return;
    }

    try {
      const res = await apiSend("/api/lookup-work-orders", "POST", { work_orders: woList });
      setMatches(res?.matches || []);
      pushToast?.("Lookup", "Lookup updated");
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || "Lookup failed.";
      pushToast?.("Error", String(msg));
    }
  }

  // auto lookup when step 2 / editedWOs changes
  useEffect(() => {
    if (step >= 2) rerunLookup(editedWOs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editedWOs, step]);

  const foundCount = useMemo(() => {
    return (matches || []).filter((m) => String(m.project_wo || "").toLowerCase() !== "not found")
      .length;
  }, [matches]);

  const filteredMatches = useMemo(() => {
    let rows = [...(matches || [])];

    const f = filter.trim().toLowerCase();
    if (f) {
      rows = rows.filter((r) =>
        [r.work_order, r.project_wo, r.client, r.project, r.pr, r.date]
          .map((v) => String(v || "").toLowerCase())
          .some((s) => s.includes(f))
      );
    }

    if (showNotFoundOnly) {
      rows = rows.filter((r) => String(r.project_wo || "").toLowerCase() === "not found");
    }

    return rows;
  }, [matches, filter, showNotFoundOnly]);

  function updateWO(i, value) {
    setEditedWOs((prev) => prev.map((v, idx) => (idx === i ? value : v)));
  }

  function addWO() {
    setEditedWOs((prev) => [...prev, ""]);
    setTimeout(() => {
      const el = document.querySelector(`[data-wo-index="${editedWOs.length}"]`);
      el?.focus?.();
    }, 0);
  }

  function resetToExtracted() {
    setEditedWOs(extractedWOs.map((w) => normalizeWO(w)));
  }

  return (
    <>
      <Topbar
        title="OCR Lookup"
        subtitle="Paste, drag & drop, or upload an image to extract Work Orders and match against your PNP database."
        right={
          <div className="topbar-actions">
            {step >= 2 ? (
              <>
                <button className="btn btn--sm" onClick={() => rerunLookup(editedWOs)}>
                  Re-run Lookup
                </button>
                <button className="btn btn--sm" onClick={resetAll}>
                  New Image
                </button>
              </>
            ) : (
              <button className="btn btn--sm" onClick={resetAll}>
                Reset
              </button>
            )}
          </div>
        }
      />

      {/* IMPORTANT: page--fill makes this area match sidebar/main height */}
      <div className="page page--fill">
        {step === 1 ? (
          <div className="card">
            <div className="card-inner">
              <div className="ocr-title">Work Order Recognition</div>
              <div className="subtle" style={{ marginTop: 6 }}>
                Click below, paste an image (Ctrl/Cmd+V), or drag & drop.
              </div>

              <div
                ref={dropRef}
                className="ocr-drop"
                onClick={() => inputRef.current?.click()}
                role="button"
                tabIndex={0}
              >
                <div className="ocr-drop-inner">
                  <div className="ocr-drop-big">Drop image here</div>
                  <div className="subtle">or click to select (PNG / JPG / GIF)</div>
                </div>

                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  className="ocr-hidden"
                  onChange={(e) => setFile(e.target.files?.[0])}
                />
              </div>

              {imageFile ? (
                <div className="ocr-file">
                  <div className="ocr-file-name">
                    <span className="pill pill--sm">Selected</span> {imageFile.name}
                  </div>
                  {imagePreview ? <img className="ocr-thumb" src={imagePreview} alt="preview" /> : null}
                </div>
              ) : null}

              <div className="ocr-actions">
                <button className="btn btn-primary" disabled={!imageFile || loading} onClick={handleExtract}>
                  {loading ? "Extracting…" : "Upload & Extract"}
                </button>
                <button className="btn" onClick={resetAll} disabled={loading}>
                  Reset
                </button>
              </div>

              {error ? <div className="ocr-error">{error}</div> : null}
            </div>
          </div>
        ) : (
          <div className="ocr-grid">
            {/* LEFT: work orders */}
            <div className="card">
              <div className="card-inner ocr-card-inner">
                <div className="ocr-row-between">
                  <div>
                    <div className="ocr-h2">Work Orders</div>
                    <div className="subtle">Edit values below. Matches update automatically.</div>
                  </div>
                  <div className="ocr-row-gap">
                    <button className="btn btn--sm" onClick={addWO}>+ Add</button>
                    <button className="btn btn--sm" onClick={resetToExtracted}>Reset</button>
                  </div>
                </div>

                <div className="ocr-wo-scroll">
                  <div className="ocr-wo-grid ocr-wo-grid--2">
                    {editedWOs.map((wo, i) => (
                      <input
                        key={`wo-${i}`}
                        data-wo-index={i}
                        className="ocr-wo-input"
                        value={wo}
                        onChange={(e) => updateWO(i, e.target.value)}
                        placeholder="WO…"
                      />
                    ))}
                  </div>
                </div>

                {error ? <div className="ocr-error">{error}</div> : null}
              </div>
            </div>

            {/* RIGHT: matches */}
            <div className="card">
              <div className="card-inner ocr-card-inner">
                <div className="ocr-row-between">
                  <div>
                    <div className="ocr-h2">Matches</div>
                    <div className="subtle">
                      Found: <strong>{foundCount}</strong> / {matches.length}
                    </div>
                  </div>

                  <div className="ocr-row-gap">
                    <input
                      className="input input--sm"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      placeholder="Filter client, project, PR, date…"
                      style={{ minWidth: 260 }}
                    />
                    <label className="ocr-toggle">
                      <input
                        type="checkbox"
                        checked={showNotFoundOnly}
                        onChange={() => setShowNotFoundOnly((v) => !v)}
                      />
                      <span>Not found only</span>
                    </label>
                  </div>
                </div>

                <div className="ocr-match-list">
                  {filteredMatches.map((m, idx) => {
                    const nf = String(m.project_wo || "").toLowerCase() === "not found";
                    return (
                      <div key={`m-${idx}`} className={`ocr-match ${nf ? "is-nf" : ""}`}>
                        <div className="ocr-match-top">
                          <div className="ocr-wo">
                            <div className="subtle subtle--xs">Input</div>
                            <div className="ocr-val">{m.work_order || "—"}</div>
                          </div>
                          <div className="ocr-wo">
                            <div className="subtle subtle--xs">Matched WO</div>
                            <div className={`ocr-val ${nf ? "ocr-warn" : ""}`}>{m.project_wo || "—"}</div>
                          </div>
                        </div>

                        <div className="ocr-match-bottom">
                          <div>
                            <div className="subtle subtle--xs">Client</div>
                            <div className="ocr-val">{m.client || "—"}</div>
                          </div>
                          <div>
                            <div className="subtle subtle--xs">Project</div>
                            <div className="ocr-val">{m.project || "—"}</div>
                          </div>
                          <div>
                            <div className="subtle subtle--xs">PR</div>
                            <div className="ocr-val">{m.pr || "—"}</div>
                          </div>
                          <div>
                            <div className="subtle subtle--xs">Date</div>
                            <div className="ocr-val">{m.date || "—"}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {filteredMatches.length === 0 ? (
                    <div className="subtle" style={{ padding: 10 }}>
                      No results. Try changing filters or editing WOs.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
