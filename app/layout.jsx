import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

export const metadata = {
  title: "Generate Bon Bahan Baku PDF",
  description: "Generate PDF A4 — Bon Bahan Baku + Customer Card",
  applicationName: "PDF Bon",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PDF Bon",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg" }],
  },
  formatDetection: {
    telephone: false,
  },
};

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
