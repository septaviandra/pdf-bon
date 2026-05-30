"use client";

import { useEffect, useRef, useState } from "react";

function loadImg(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

async function rotateDataUrl(dataUrl, degrees) {
  const img = await loadImg(dataUrl);
  const canvas = document.createElement("canvas");
  const rad = (degrees * Math.PI) / 180;
  const swap = degrees === 90 || degrees === -90 || degrees === 270;
  canvas.width = swap ? img.height : img.width;
  canvas.height = swap ? img.width : img.height;
  const ctx = canvas.getContext("2d");
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return canvas.toDataURL("image/jpeg", 0.92);
}

function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
    }
    [M[i], M[maxRow]] = [M[maxRow], M[i]];
    if (Math.abs(M[i][i]) < 1e-12) throw new Error("Quad terlalu tipis/degenerate");
    for (let k = i + 1; k < n; k++) {
      const f = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j];
    }
  }
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

function computeHomography(src, dst) {
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const [sx, sy] = src[i];
    const [dx, dy] = dst[i];
    A.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx]);
    b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy]);
    b.push(dy);
  }
  const h = solveLinear(A, b);
  return [...h, 1];
}

function sampleBilinear(data, w, h, x, y) {
  if (x < 0 || y < 0 || x >= w - 1 || y >= h - 1) return [255, 255, 255, 255];
  const x0 = x | 0;
  const y0 = y | 0;
  const dx = x - x0;
  const dy = y - y0;
  const i00 = (y0 * w + x0) * 4;
  const i10 = i00 + 4;
  const i01 = i00 + w * 4;
  const i11 = i01 + 4;
  const out = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const top = data[i00 + c] * (1 - dx) + data[i10 + c] * dx;
    const bot = data[i01 + c] * (1 - dx) + data[i11 + c] * dx;
    out[c] = top * (1 - dy) + bot * dy;
  }
  return out;
}

async function perspectiveCrop(dataUrl, quad) {
  const img = await loadImg(dataUrl);
  const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const wTop = dist(quad[0], quad[1]);
  const wBot = dist(quad[3], quad[2]);
  const hLeft = dist(quad[0], quad[3]);
  const hRight = dist(quad[1], quad[2]);
  let outW = Math.round(Math.max(wTop, wBot));
  let outH = Math.round(Math.max(hLeft, hRight));
  if (outW < 4 || outH < 4) throw new Error("Area crop terlalu kecil");
  const maxDim = 1800;
  if (outW > maxDim || outH > maxDim) {
    const s = maxDim / Math.max(outW, outH);
    outW = Math.round(outW * s);
    outH = Math.round(outH * s);
  }

  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = img.width;
  srcCanvas.height = img.height;
  const srcCtx = srcCanvas.getContext("2d");
  srcCtx.drawImage(img, 0, 0);
  const srcData = srcCtx.getImageData(0, 0, img.width, img.height).data;

  const srcPts = [
    [0, 0],
    [outW, 0],
    [outW, outH],
    [0, outH],
  ];
  const dstPts = quad.map((p) => [p.x, p.y]);
  const H = computeHomography(srcPts, dstPts);

  const outCanvas = document.createElement("canvas");
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext("2d");
  const outImg = outCtx.createImageData(outW, outH);
  const arr = outImg.data;

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const w = H[6] * x + H[7] * y + H[8];
      const sx = (H[0] * x + H[1] * y + H[2]) / w;
      const sy = (H[3] * x + H[4] * y + H[5]) / w;
      const px = sampleBilinear(srcData, img.width, img.height, sx, sy);
      const idx = (y * outW + x) * 4;
      arr[idx] = px[0];
      arr[idx + 1] = px[1];
      arr[idx + 2] = px[2];
      arr[idx + 3] = px[3];
    }
  }
  outCtx.putImageData(outImg, 0, 0);
  return outCanvas.toDataURL("image/jpeg", 0.92);
}

export default function ImageEditor({ dataUrl: initial, onApply, onCancel }) {
  const [workingUrl, setWorkingUrl] = useState(initial);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [corners, setCorners] = useState(null);
  const [dragIdx, setDragIdx] = useState(null);
  const [busy, setBusy] = useState(false);
  const [display, setDisplay] = useState({ w: 0, h: 0 });

  const containerRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadImg(workingUrl).then((img) => {
      if (cancelled) return;
      setImgSize({ w: img.width, h: img.height });
      const inset = Math.min(img.width, img.height) * 0.05;
      setCorners([
        { x: inset, y: inset },
        { x: img.width - inset, y: inset },
        { x: img.width - inset, y: img.height - inset },
        { x: inset, y: img.height - inset },
      ]);
    });
    return () => {
      cancelled = true;
    };
  }, [workingUrl]);

  useEffect(() => {
    if (!imgSize.w) return;
    const recalc = () => {
      const c = containerRef.current;
      if (!c) return;
      const maxW = c.clientWidth - 16;
      const maxH = c.clientHeight - 16;
      const r = Math.min(maxW / imgSize.w, maxH / imgSize.h);
      setDisplay({ w: Math.max(1, imgSize.w * r), h: Math.max(1, imgSize.h * r) });
    };
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [imgSize]);

  const scale = display.w / (imgSize.w || 1);

  useEffect(() => {
    if (dragIdx == null) return;
    const move = (e) => {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const px = (e.clientX - rect.left) / scale;
      const py = (e.clientY - rect.top) / scale;
      setCorners((prev) =>
        prev.map((c, i) =>
          i === dragIdx
            ? {
                x: Math.max(0, Math.min(imgSize.w, px)),
                y: Math.max(0, Math.min(imgSize.h, py)),
              }
            : c
        )
      );
    };
    const up = () => setDragIdx(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragIdx, scale, imgSize.w, imgSize.h]);

  async function handleRotate(deg) {
    if (busy) return;
    setBusy(true);
    try {
      const url = await rotateDataUrl(workingUrl, deg);
      setWorkingUrl(url);
    } finally {
      setBusy(false);
    }
  }

  function handleResetCrop() {
    setCorners([
      { x: 0, y: 0 },
      { x: imgSize.w, y: 0 },
      { x: imgSize.w, y: imgSize.h },
      { x: 0, y: imgSize.h },
    ]);
  }

  async function handleApply() {
    if (busy || !corners) return;
    setBusy(true);
    try {
      const fullRect = [
        [0, 0],
        [imgSize.w, 0],
        [imgSize.w, imgSize.h],
        [0, imgSize.h],
      ];
      const noCrop = corners.every(
        (c, i) =>
          Math.abs(c.x - fullRect[i][0]) < 1 && Math.abs(c.y - fullRect[i][1]) < 1
      );
      const result = noCrop ? workingUrl : await perspectiveCrop(workingUrl, corners);
      onApply(result);
    } catch (err) {
      console.error(err);
      alert("Gagal memproses gambar: " + (err?.message || err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true">
      <div style={styles.modal}>
        <div style={styles.header}>
          <strong>Edit Gambar</strong>
          <span style={styles.headerHint}>
            Geser titik biru di tiap sudut · gunakan tombol rotate
          </span>
        </div>

        <div ref={containerRef} style={styles.canvasArea}>
          {imgSize.w > 0 && display.w > 0 && (
            <div
              ref={wrapperRef}
              style={{
                position: "relative",
                width: display.w,
                height: display.h,
                touchAction: "none",
                userSelect: "none",
              }}
            >
              <img
                src={workingUrl}
                alt=""
                draggable={false}
                style={{
                  width: "100%",
                  height: "100%",
                  display: "block",
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              />
              {corners && (
                <svg
                  width={display.w}
                  height={display.h}
                  style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
                >
                  <polygon
                    points={corners
                      .map((c) => `${c.x * scale},${c.y * scale}`)
                      .join(" ")}
                    fill="rgba(99,102,241,0.15)"
                    stroke="#6366f1"
                    strokeWidth="2"
                  />
                </svg>
              )}
              {corners &&
                corners.map((c, i) => (
                  <div
                    key={i}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      setDragIdx(i);
                    }}
                    style={{
                      position: "absolute",
                      left: c.x * scale - 14,
                      top: c.y * scale - 14,
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "#fff",
                      border: "3px solid #6366f1",
                      cursor: dragIdx === i ? "grabbing" : "grab",
                      touchAction: "none",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                    }}
                    aria-label={`Sudut ${i + 1}`}
                  />
                ))}
            </div>
          )}
        </div>

        <div style={styles.toolbar}>
          <button
            type="button"
            onClick={() => handleRotate(-90)}
            disabled={busy}
            style={styles.iconBtn}
            title="Putar kiri 90°"
          >
            ↺ 90°
          </button>
          <button
            type="button"
            onClick={() => handleRotate(90)}
            disabled={busy}
            style={styles.iconBtn}
            title="Putar kanan 90°"
          >
            ↻ 90°
          </button>
          <button
            type="button"
            onClick={handleResetCrop}
            disabled={busy}
            style={styles.iconBtn}
            title="Reset crop ke ukuran penuh"
          >
            Reset Crop
          </button>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={styles.cancelBtn}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={busy}
            style={styles.applyBtn}
          >
            {busy ? "Memproses…" : "Terapkan"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.75)",
    zIndex: 10000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  modal: {
    background: "#0f172a",
    color: "#e5e7eb",
    borderRadius: 12,
    width: "100%",
    maxWidth: 960,
    height: "100%",
    maxHeight: 760,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
  },
  header: {
    padding: "12px 16px",
    borderBottom: "1px solid #1f2937",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerHint: { fontSize: 12, color: "#94a3b8" },
  canvasArea: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "repeating-conic-gradient(#1e293b 0% 25%, #0f172a 0% 50%) 50% / 24px 24px",
    overflow: "hidden",
  },
  toolbar: {
    padding: 12,
    borderTop: "1px solid #1f2937",
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  iconBtn: {
    background: "#1f2937",
    color: "#e5e7eb",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  cancelBtn: {
    background: "transparent",
    color: "#e5e7eb",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  applyBtn: {
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "8px 18px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
};
