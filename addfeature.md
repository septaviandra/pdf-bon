# Add Feature: Integrasi ke Project Next.js yang Sudah Ada

Panduan menambahkan fitur dari project ini ke Next.js codebase lain. Fitur dibagi 3 modul independen — Anda bisa pasang salah satu atau ketiganya.

| Modul | Yang ditambahkan | Dependency | Files | Estimasi waktu |
|---|---|---|---|---|
| A. PDF Generator | Upload gambar → generate PDF A4 | `jspdf` | 1 component | 5 menit |
| B. Image Editor | Rotate + perspective crop modal | (tanpa lib) | 1 component | 5 menit |
| C. PWA | Installable, offline cache | (tanpa lib) | 4 files + metadata | 10 menit |

Asumsi: project target sudah pakai **Next.js 13+ App Router**. Untuk Pages Router lihat catatan di bagian akhir.

---

## A. PDF Generator

Komponen client untuk upload Bon + Customer Cards, generate PDF A4 portrait dengan split 45/55, grid customer adaptif, dan footer timestamp.

### A.1. Install dependency

```bash
npm install jspdf
```

### A.2. Copy file

Salin `components/PdfGenerator.jsx` ke project Anda — letaknya bebas, mis. `components/pdf/PdfGenerator.jsx`. File ini self-contained: inline styles, no external CSS.

### A.3. Pakai di route mana pun

```jsx
// app/bon/page.jsx
import PdfGenerator from "@/components/PdfGenerator";

export default function Page() {
  return <PdfGenerator />;
}
```

Sudah ada `"use client";` di komponen, jadi tidak perlu di route file.

### A.4. Customisasi yang sering dipakai

Buka `PdfGenerator.jsx` dan ubah constant/value berikut:

| Apa | Lokasi | Default | Cara ubah |
|---|---|---|---|
| Maks customer card | `const MAX_CUSTOMER = 6;` | 6 | Ganti angka |
| Nama file output | `doc.save("bon-bahan-baku.pdf")` | `bon-bahan-baku.pdf` | Ganti string |
| Split 45/55 | `const topH = contentH * 0.45;` dst | 45/55 | Ubah multiplier (jumlah harus = 1) |
| Margin | `const margin = 10;` | 10mm | Ganti angka (satuan mm) |
| Format PDF | `format: "a4"` | A4 | Ganti ke `"letter"`, atau array `[w, h]` mm |
| Orientasi | `orientation: "portrait"` | Portrait | Ganti `"landscape"` (sesuaikan layout) |
| Grid layout | function `gridLayout(n)` | 1×1 → 2×1 → 2×2 → 2×3 | Edit aturan kondisional |
| Footer locale | `toLocaleString("id-ID", …)` | Indonesia | Ganti BCP47 tag (`en-US`, `ja-JP`, dll) |

### A.5. Jika sudah punya form/state sendiri

Pisahkan logika PDF dari UI dengan ekstrak 2 helper:

```js
// utils/pdf.js
import { jsPDF } from "jspdf";

export function loadImage(dataUrl) { /* dari PdfGenerator */ }
export function detectFormat(dataUrl) { /* dari PdfGenerator */ }
export async function drawFit(doc, dataUrl, x, y, w, h) { /* dari PdfGenerator */ }
export function gridLayout(n) { /* dari PdfGenerator */ }

export async function generateBonPdf({ bon, customers, fileName = "bon.pdf" }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  // ... isi logika dari handleGenerate()
  doc.save(fileName);
}
```

Lalu panggil dari komponen UI Anda sendiri.

---

## B. Image Editor (Rotate + Perspective Crop)

Modal editor yang bisa dipakai di **fitur apapun yang punya upload gambar** — bukan hanya untuk PDF.

### B.1. Copy file

Salin `components/ImageEditor.jsx`. Tidak ada dependency tambahan — semua math (homography, bilinear sampling) pure JS.

### B.2. API komponen

```jsx
<ImageEditor
  dataUrl={string}              // base64 data URL gambar
  onApply={(newDataUrl) => {}}  // dipanggil dengan hasil edit (data URL JPEG)
  onCancel={() => {}}           // dipanggil saat user batal
/>
```

### B.3. Integrasi pola umum

```jsx
"use client";
import { useState } from "react";
import ImageEditor from "@/components/ImageEditor";

export default function MyUploadForm() {
  const [imageUrl, setImageUrl] = useState(null);
  const [editing, setEditing] = useState(false);

  async function onFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageUrl(reader.result);
    reader.readAsDataURL(file);
  }

  return (
    <>
      <input type="file" accept="image/*" onChange={onFileChange} />
      {imageUrl && (
        <>
          <img src={imageUrl} alt="" />
          <button onClick={() => setEditing(true)}>Edit</button>
        </>
      )}

      {editing && (
        <ImageEditor
          dataUrl={imageUrl}
          onApply={(newUrl) => {
            setImageUrl(newUrl);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </>
  );
}
```

### B.4. Hasil edit

`onApply` menerima **data URL JPEG quality 0.92**. Jika Anda butuh:
- **PNG**: di `ImageEditor.jsx`, ganti semua `toDataURL("image/jpeg", 0.92)` jadi `toDataURL("image/png")`
- **Blob untuk upload**: convert data URL → Blob via `await fetch(dataUrl).then(r => r.blob())`
- **Original resolution**: ubah konstanta `const maxDim = 1800;` di `perspectiveCrop()`

### B.5. Customisasi lain

| Apa | Lokasi | Cara |
|---|---|---|
| Warna handle/polygon | `style={{... border: "3px solid #6366f1" ...}}` & polygon `stroke` | Cari `#6366f1` di file |
| Inset awal corners | `const inset = Math.min(...) * 0.05;` | Ubah `0.05` jadi `0` untuk start di pojok |
| Max ukuran output | `const maxDim = 1800;` di `perspectiveCrop` | Naikkan untuk kualitas lebih tinggi |
| Sampling nearest (lebih cepat) | Function `sampleBilinear` | Ganti seluruhnya jadi `(data, w, h, x, y) => { const i = ((y|0)*w + (x|0))*4; return [data[i],data[i+1],data[i+2],data[i+3]]; }` |

---

## C. PWA (Installable + Offline)

Konversi Next.js app jadi PWA tanpa library (`next-pwa`, `serwist`, dll). Cocok untuk app static-heavy.

### C.1. Copy 4 files ke `public/`

- `public/manifest.webmanifest`
- `public/icon.svg`
- `public/icon-maskable.svg`
- `public/sw.js`

Ubah field di `manifest.webmanifest`: `name`, `short_name`, `description`, `theme_color`, `background_color` sesuai brand Anda. Ganti SVG icon dengan logo Anda.

### C.2. Copy `components/PwaRegister.jsx`

Komponen ini meng-handle:
- Registrasi service worker
- Listen event `beforeinstallprompt`
- Render tombol floating "Install App" jika browser ready

### C.3. Update `app/layout.jsx`

```jsx
import PwaRegister from "@/components/PwaRegister";

export const metadata = {
  // ... metadata existing ...
  manifest: "/manifest.webmanifest",
  applicationName: "Nama App Anda",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Nama App",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg" }],
  },
};

// PENTING di Next.js 14+: themeColor di viewport export, BUKAN di metadata
export const viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
```

### C.4. Test

Service worker **hanya register di production build** atau via HTTPS. Untuk test:

```bash
npm run build
npm run start
```

Buka di Chrome/Edge → harus muncul ikon install di address bar dan tombol floating "Install App".

### C.5. Bila konflik dengan SW lain

Jika project sudah punya service worker (mis. dari `next-pwa`):
- **Jangan** pasang dua SW. Pilih satu.
- Hapus pendaftaran SW lama atau merge logic dari `public/sw.js` ke SW existing.
- Cache strategy di `sw.js` adalah **stale-while-revalidate** untuk GET same-origin — adjust sesuai kebutuhan.

### C.6. Cache versioning

Saat update file static yang di-cache, naikkan versi:

```js
const CACHE = "pdf-bon-v1"; // → "pdf-bon-v2"
```

Listener `activate` otomatis hapus cache versi lama.

---

## Catatan Pages Router (Next.js sebelum 13)

Komponen client (`"use client"`) tidak perlu — semua React component default sudah client di Pages Router. Tapi:

- **PdfGenerator & ImageEditor**: hapus baris `"use client";` di paling atas
- **Layout/metadata PWA**: gunakan `<Head>` di `_app.js` atau `_document.js`:
  ```jsx
  <Head>
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="theme-color" content="#4f46e5" />
    <link rel="apple-touch-icon" href="/icon.svg" />
  </Head>
  ```
- **PwaRegister**: render di `_app.js` di luar `<Component>` agar persisten antar route

---

## Catatan TypeScript

File komponen di repo ini `.jsx`. Untuk project TS:

1. Rename file jadi `.tsx`
2. Tambahkan type pada props:
   ```ts
   type ImageEditorProps = {
     dataUrl: string;
     onApply: (newDataUrl: string) => void;
     onCancel: () => void;
   };
   export default function ImageEditor({ dataUrl, onApply, onCancel }: ImageEditorProps) { ... }
   ```
3. Beri tipe pada state `{ kind: "bon" } | { kind: "cust"; idx: number } | null` di PdfGenerator
4. Untuk `jsPDF`: dynamic import sudah aman, atau pakai `import type { jsPDF } from "jspdf"` untuk type-only

---

## Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| `jsPDF is not a constructor` | Import salah | Pastikan `const { jsPDF } = await import("jspdf")` (named export) |
| PDF kosong di mobile | Image belum ter-load saat addImage | `drawFit` sudah pakai `await loadImage` — jangan refactor jadi sync |
| Install button tidak muncul | SW belum register / sudah installed | Cek DevTools → Application → Service Workers. Hard reload (Ctrl+Shift+R) |
| Crop hasil putih semua | Corners terlalu dekat (degenerate quad) | Validasi: jarak antar corner > beberapa px |
| Crop lambat di gambar besar | Pure JS warp O(W*H) | Naikkan `maxDim` lebih kecil (mis. 1200), atau ganti sampling ke nearest |
| Offline mode tidak jalan di dev | `next dev` tidak serve SW | Test pakai `npm run build && npm run start` |
| Conflict CSP | SW butuh `script-src 'self'` | Tambahkan di CSP header |

---

## Lisensi & atribusi

Tidak perlu — semua file di repo ini MIT. Boleh copy-paste tanpa attribution.
