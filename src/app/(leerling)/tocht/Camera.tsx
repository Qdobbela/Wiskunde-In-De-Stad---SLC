"use client";

import { useEffect, useRef, useState } from "react";
import { asset } from "@/lib/basePath";
import type { GeoFix, GeoStatus } from "@/lib/student/useGeolocation";
import { StatusBar } from "@/components/student/StatusBar";
import styles from "./camera.module.css";

/** Longest side of the uploaded photo, in pixels. */
const MAX_SIDE = 1600;

type CameraProps = {
  prompt: string;
  geoStatus: GeoStatus;
  fix: GeoFix | null;
  onCapture: (photo: Blob) => void;
  onCancel: () => void;
};

/**
 * L08 Camera. Live camera only (getUserMedia + canvas): there is no file
 * input, so photos can't come from the gallery (anti-cheat rule 6).
 */
export function Camera({ prompt, geoStatus, fix, onCapture, onCancel }: CameraProps) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          video.current.play().catch(() => {});
        }
      })
      .catch(() => setError("Geen toegang tot de camera. Zet de camera aan voor deze website in de instellingen van je gsm."));
    if (!navigator.mediaDevices) setError("Deze browser kan de camera niet gebruiken.");
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function shoot() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const scale = Math.min(1, MAX_SIDE / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => blob && onCapture(blob), "image/jpeg", 0.85);
  }

  return (
    <main className={styles.screen}>
      <StatusBar status={geoStatus} fix={fix} />
      <div className={styles.head}>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Annuleer
        </button>
        <span className={styles.live}>Live</span>
      </div>
      <p className={styles.label}>Foto-opdracht</p>
      <p className={styles.prompt}>{prompt}</p>
      <div className={styles.viewfinder}>
        <video ref={video} className={styles.video} playsInline muted onLoadedMetadata={() => setReady(true)} />
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG from Figma */}
        <img src={asset("/figma/kader.svg")} alt="" className={styles.frame} />
        {error && <p className={styles.error}>{error}</p>}
      </div>
      <div className={styles.controls}>
        <span className={styles.noGallery}>
          <span className={styles.noGalleryTitle}>Galerij</span>
          <span>uitgeschakeld</span>
        </span>
        <button type="button" className={styles.shutter} onClick={shoot} disabled={!ready} aria-label="Foto nemen" />
        <span className={styles.balance} />
      </div>
    </main>
  );
}
