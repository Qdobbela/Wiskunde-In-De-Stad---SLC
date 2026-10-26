"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { BASE_PATH } from "@/lib/basePath";
import styles from "./JoinQr.module.css";

/** The link a group scans: the site with the session code filled in. */
export function joinUrl(code: string) {
  return `${window.location.origin}${BASE_PATH}/?sessie=${encodeURIComponent(code)}`;
}

/** QR code to join a session, drawn in the browser in the token colours. */
export function JoinQr({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    const css = getComputedStyle(document.documentElement);
    QRCode.toString(joinUrl(code), {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: {
        dark: css.getPropertyValue("--color-text-primary").trim(),
        light: css.getPropertyValue("--color-bg-surface").trim(),
      },
    }).then(setSvg);
  }, [code]);

  return (
    <div
      className={styles.qr}
      role="img"
      aria-label={`QR-code om mee te doen met sessie ${code}`}
      // The SVG comes from the qrcode library, built from our own URL.
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}
