# PDF Bon Bahan Baku

Generate PDF A4 berisi 1 gambar **Bon Bahan Baku** di atas dan hingga 6 gambar **Customer Card** di bawah, dengan fitur edit gambar (rotate + perspective crop) ala CamScanner. Aplikasi adalah PWA — bisa di-install ke desktop/HP.

- **Live App**: https://pdf-bon.vercel.app
- **Source**: https://github.com/septaviandra/pdf-bon

## Fitur

- Upload 1 gambar Bon (klik atau drag-and-drop)
- Upload hingga 6 gambar Customer Card (multi-file)
- Editor gambar in-browser:
  - Rotate 90° kiri / kanan
  - Perspective crop dengan 4-corner draggable (quad warp via homography matrix + bilinear sampling)
- Layout PDF otomatis menyesuaikan jumlah Customer Card (1×1 / 2×1 / 2×2 / 2×3)
- Split halaman 45% (Bon) / 55% (Customer Card)
- Footer timestamp pembuatan (timezone lokal, format Indonesia)
- PWA: installable, service worker, offline cache

## Tech Stack

- Next.js 15 (App Router)
- React 19
- jsPDF (dynamic import, client-side only)
- Pure JS untuk perspective warp (tanpa OpenCV/canvas library)
- Service Worker manual + Web App Manifest

## Layout PDF

```
+---------------------------+
|                           |
|       Bon Bahan Baku      |  45% tinggi
|       (1 gambar)          |
|                           |
+---------------------------+  <- garis pemisah
|                           |
|   Customer Cards (grid    |
|   2 kolom, baris auto)    |  55% tinggi
|                           |
+---------------------------+
       Dibuat: <timestamp>      <- footer
```

A4 portrait, margin 10mm semua sisi.

## Struktur File

```
app/
  layout.jsx        # root layout + metadata PWA
  page.jsx          # render <PdfGenerator />
  globals.css
components/
  PdfGenerator.jsx  # UI + logika generate PDF (jsPDF)
  ImageEditor.jsx   # modal editor: rotate + perspective crop
  PwaRegister.jsx   # registrasi service worker + install prompt
public/
  manifest.webmanifest
  icon.svg          # ikon utama
  icon-maskable.svg # ikon maskable (Android adaptive)
  sw.js             # service worker (stale-while-revalidate)
```

## Jalankan Lokal

```bash
npm install
npm run dev      # development di http://localhost:3000
# atau
npm run build && npm run start   # production build (service worker aktif)
```

Service worker hanya register di build production atau via HTTPS.

## Deploy

Project ini di-deploy ke Vercel:

```bash
npx vercel --prod
```

Untuk auto-deploy via Git push, connect repo di Vercel dashboard → Settings → Git.

## Cara Pakai

1. Buka aplikasi
2. Upload gambar **Bon Bahan Baku** (drag-drop atau klik)
3. (Opsional) Upload gambar **Customer Card**, maks 6
4. Klik tombol pensil (✎) di tiap preview untuk edit:
   - Rotate kiri/kanan 90°
   - Geser 4 titik biru ke sudut dokumen untuk perspective crop
   - Klik **Terapkan**
5. Klik **Generate & Download PDF** — file `bon-bahan-baku.pdf` ter-download

## Install sebagai App

- **Chrome/Edge desktop**: ikon install muncul di address bar, atau klik tombol floating "Install App"
- **Android Chrome**: banner "Add to Home screen"
- **iOS Safari**: Share → Add to Home Screen

## License

MIT
