"use client";

import { useEffect, useState } from "react";

export default function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .catch((err) => console.warn("SW registration failed:", err));
      });
    }

    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    if (isStandalone) setInstalled(true);

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      setDeferredPrompt(null);
    }
  }

  if (installed || !deferredPrompt) return null;

  return (
    <button
      type="button"
      onClick={handleInstall}
      style={styles.btn}
      aria-label="Install aplikasi"
    >
      <span style={styles.icon}>⤓</span>
      Install App
    </button>
  );
}

const styles = {
  btn: {
    position: "fixed",
    right: 16,
    bottom: 16,
    zIndex: 9999,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 16px",
    background: "#111827",
    color: "#fff",
    border: "none",
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
  },
  icon: { fontSize: 16, lineHeight: 1 },
};
