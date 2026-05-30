"use client";

import { useRef, useState } from "react";
import ImageEditor from "./ImageEditor";

const MAX_CUSTOMER = 6;

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function detectFormat(dataUrl) {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

function gridLayout(n) {
  if (n <= 1) return { cols: 1, rows: 1 };
  if (n <= 2) return { cols: 2, rows: 1 };
  if (n <= 4) return { cols: 2, rows: 2 };
  return { cols: 2, rows: 3 };
}

async function drawFit(doc, dataUrl, boxX, boxY, boxW, boxH) {
  const img = await loadImage(dataUrl);
  const ratio = Math.min(boxW / img.width, boxH / img.height);
  const drawW = img.width * ratio;
  const drawH = img.height * ratio;
  const x = boxX + (boxW - drawW) / 2;
  const y = boxY + (boxH - drawH) / 2;
  doc.addImage(dataUrl, detectFormat(dataUrl), x, y, drawW, drawH);
}

export default function PdfGenerator() {
  const [bon, setBon] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dragBon, setDragBon] = useState(false);
  const [dragCust, setDragCust] = useState(false);
  const [editing, setEditing] = useState(null);

  const bonInputRef = useRef(null);
  const custInputRef = useRef(null);

  function openEditor(kind, idx) {
    setEditing(kind === "bon" ? { kind: "bon" } : { kind: "cust", idx });
  }

  function handleEditorApply(newDataUrl) {
    if (!editing) return;
    if (editing.kind === "bon") {
      setBon((prev) => (prev ? { ...prev, dataUrl: newDataUrl } : prev));
    } else {
      setCustomers((prev) =>
        prev.map((c, i) =>
          i === editing.idx ? { ...c, dataUrl: newDataUrl } : c
        )
      );
    }
    setEditing(null);
  }

  async function handleBonFiles(files) {
    const file = files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const dataUrl = await fileToDataURL(file);
    setBon({ name: file.name, dataUrl });
  }

  async function handleCustomerFiles(files) {
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith("image/")
    );
    const slotsLeft = MAX_CUSTOMER - customers.length;
    if (slotsLeft <= 0) return;
    const accepted = imageFiles.slice(0, slotsLeft);
    const loaded = await Promise.all(
      accepted.map(async (f) => ({
        name: f.name,
        dataUrl: await fileToDataURL(f),
      }))
    );
    setCustomers((prev) => [...prev, ...loaded]);
  }

  function removeBon() {
    setBon(null);
    if (bonInputRef.current) bonInputRef.current.value = "";
  }

  function removeCustomer(idx) {
    setCustomers((prev) => prev.filter((_, i) => i !== idx));
    if (custInputRef.current) custInputRef.current.value = "";
  }

  async function handleGenerate() {
    if (!bon) return;
    setIsGenerating(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageW = 210;
      const pageH = 297;
      const margin = 10;

      const contentW = pageW - margin * 2;
      const contentH = pageH - margin * 2;

      const topH = contentH * 0.45;
      const bottomH = contentH * 0.55;
      const topY = margin;
      const bottomY = margin + topH;

      await drawFit(doc, bon.dataUrl, margin, topY, contentW, topH);

      const midY = margin + topH;
      doc.setLineWidth(0.2);
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, midY, margin + contentW, midY);

      const { cols, rows } = gridLayout(customers.length);
      const cellW = cols > 0 ? contentW / cols : contentW;
      const cellH = rows > 0 ? bottomH / rows : bottomH;

      for (let i = 0; i < customers.length && i < MAX_CUSTOMER; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cellX = margin + col * cellW;
        const cellY = bottomY + row * cellH;
        const pad = 2;
        await drawFit(
          doc,
          customers[i].dataUrl,
          cellX + pad,
          cellY + pad,
          cellW - pad * 2,
          cellH - pad * 2
        );
      }

      const now = new Date();
      const footerText = `Dibuat: ${now.toLocaleString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}`;
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(footerText, pageW / 2, pageH - 4, { align: "center" });

      doc.save("bon-bahan-baku.pdf");
    } catch (err) {
      console.error(err);
      alert("Gagal generate PDF: " + (err?.message || err));
    } finally {
      setIsGenerating(false);
    }
  }

  function onDropBon(e) {
    e.preventDefault();
    setDragBon(false);
    handleBonFiles(e.dataTransfer.files);
  }

  function onDropCust(e) {
    e.preventDefault();
    setDragCust(false);
    handleCustomerFiles(e.dataTransfer.files);
  }

  const canGenerate = !!bon && !isGenerating;

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>Generate PDF — Bon Bahan Baku</h1>
          <p style={styles.subtitle}>
            A4 Portrait, 1 Bon di atas + 6 Customer Card (2×3) di bawah.
          </p>
        </header>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>1. Bon Bahan Baku</h2>
            <span style={styles.badge}>1 gambar</span>
          </div>

          <div
            style={{
              ...styles.dropzone,
              ...(dragBon ? styles.dropzoneActive : null),
            }}
            onClick={() => bonInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragBon(true);
            }}
            onDragLeave={() => setDragBon(false)}
            onDrop={onDropBon}
          >
            <input
              ref={bonInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => handleBonFiles(e.target.files)}
            />
            {bon ? (
              <div style={styles.previewSingleWrap}>
                <img src={bon.dataUrl} alt={bon.name} style={styles.previewSingle} />
                <div style={styles.btnGroup}>
                  <button
                    type="button"
                    style={styles.editBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditor("bon");
                    }}
                    aria-label="Edit bon"
                    title="Crop & Rotate"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    style={styles.removeBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBon();
                    }}
                    aria-label="Hapus bon"
                  >
                    ✕
                  </button>
                </div>
                <div style={styles.fileName}>{bon.name}</div>
              </div>
            ) : (
              <div style={styles.dropPlaceholder}>
                <div style={styles.dropIcon}>📄</div>
                <div>
                  <strong>Klik</strong> atau drag-and-drop gambar Bon di sini
                </div>
                <small style={styles.muted}>Format: PNG / JPG / WEBP</small>
              </div>
            )}
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>2. Customer Card</h2>
            <span style={styles.badge}>
              {customers.length} / {MAX_CUSTOMER} gambar
            </span>
          </div>

          <div
            style={{
              ...styles.dropzone,
              ...(dragCust ? styles.dropzoneActive : null),
            }}
            onClick={() => custInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragCust(true);
            }}
            onDragLeave={() => setDragCust(false)}
            onDrop={onDropCust}
          >
            <input
              ref={custInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => handleCustomerFiles(e.target.files)}
            />
            {customers.length === 0 ? (
              <div style={styles.dropPlaceholder}>
                <div style={styles.dropIcon}>🖼️</div>
                <div>
                  <strong>Klik</strong> atau drag-and-drop hingga {MAX_CUSTOMER} gambar
                </div>
                <small style={styles.muted}>
                  Akan disusun grid 2 kolom × 3 baris di PDF
                </small>
              </div>
            ) : (
              <div style={styles.gridPreview}>
                {customers.map((c, idx) => (
                  <div key={idx} style={styles.gridItem}>
                    <img src={c.dataUrl} alt={c.name} style={styles.gridImg} />
                    <div style={styles.btnGroup}>
                      <button
                        type="button"
                        style={styles.editBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditor("cust", idx);
                        }}
                        aria-label={`Edit ${c.name}`}
                        title="Crop & Rotate"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        style={styles.removeBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeCustomer(idx);
                        }}
                        aria-label={`Hapus ${c.name}`}
                      >
                        ✕
                      </button>
                    </div>
                    <div style={styles.gridIndex}>#{idx + 1}</div>
                  </div>
                ))}
                {customers.length < MAX_CUSTOMER && (
                  <div style={styles.gridAdd}>
                    <span>+ Tambah</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <div style={styles.actions}>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate}
            style={{
              ...styles.generateBtn,
              ...(canGenerate ? null : styles.generateBtnDisabled),
            }}
          >
            {isGenerating ? "Membuat PDF…" : "Generate & Download PDF"}
          </button>
          {!bon && (
            <div style={styles.hint}>
              Upload <strong>Bon Bahan Baku</strong> terlebih dahulu untuk mengaktifkan tombol.
            </div>
          )}
        </div>
      </div>

      {editing && (
        <ImageEditor
          dataUrl={
            editing.kind === "bon"
              ? bon?.dataUrl
              : customers[editing.idx]?.dataUrl
          }
          onApply={handleEditorApply}
          onCancel={() => setEditing(null)}
        />
      )}
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "32px 16px",
    display: "flex",
    justifyContent: "center",
  },
  container: {
    width: "100%",
    maxWidth: 880,
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  header: { textAlign: "center" },
  title: { fontSize: 24, fontWeight: 700, marginBottom: 6 },
  subtitle: { color: "#6b7280", fontSize: 14 },
  section: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 20,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: 600 },
  badge: {
    background: "#eef2ff",
    color: "#3730a3",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
  },
  dropzone: {
    border: "2px dashed #d1d5db",
    borderRadius: 10,
    padding: 16,
    minHeight: 180,
    cursor: "pointer",
    transition: "all 120ms ease",
    background: "#fafafa",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  dropzoneActive: {
    borderColor: "#6366f1",
    background: "#eef2ff",
  },
  dropPlaceholder: {
    textAlign: "center",
    color: "#374151",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    alignItems: "center",
  },
  dropIcon: { fontSize: 32 },
  muted: { color: "#9ca3af" },
  previewSingleWrap: {
    position: "relative",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  previewSingle: {
    maxWidth: "100%",
    maxHeight: 260,
    objectFit: "contain",
    borderRadius: 6,
    background: "#fff",
    border: "1px solid #e5e7eb",
  },
  fileName: { fontSize: 12, color: "#6b7280" },
  gridPreview: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 12,
    width: "100%",
  },
  gridItem: {
    position: "relative",
    aspectRatio: "4 / 3",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    overflow: "hidden",
  },
  gridImg: { width: "100%", height: "100%", objectFit: "contain" },
  gridIndex: {
    position: "absolute",
    left: 6,
    bottom: 6,
    background: "rgba(17,24,39,0.7)",
    color: "#fff",
    fontSize: 11,
    padding: "2px 6px",
    borderRadius: 4,
  },
  gridAdd: {
    aspectRatio: "4 / 3",
    border: "2px dashed #d1d5db",
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#6b7280",
    fontSize: 14,
  },
  btnGroup: {
    position: "absolute",
    top: 6,
    right: 6,
    display: "flex",
    gap: 6,
    zIndex: 2,
  },
  removeBtn: {
    width: 26,
    height: 26,
    borderRadius: "50%",
    border: "none",
    background: "rgba(239,68,68,0.95)",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
  },
  editBtn: {
    width: 26,
    height: 26,
    borderRadius: "50%",
    border: "none",
    background: "rgba(79,70,229,0.95)",
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
  },
  actions: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  generateBtn: {
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    padding: "12px 24px",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    minWidth: 260,
  },
  generateBtnDisabled: {
    background: "#9ca3af",
    cursor: "not-allowed",
  },
  hint: { color: "#6b7280", fontSize: 13 },
};
