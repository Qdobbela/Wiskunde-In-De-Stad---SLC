import type { GeoFix, GeoStatus } from "@/lib/student/useGeolocation";
import styles from "./student.module.css";

const TEXT: Record<GeoStatus, string> = {
  idle: "",
  searching: "GPS zoeken…",
  ok: "GPS ok",
  weak: "GPS zwak",
  denied: "GPS uit",
  unsupported: "Geen GPS",
};

/** Top bar of every student screen: the real GPS state (the phone shows the time). */
export function StatusBar({ status, fix }: { status: GeoStatus; fix?: GeoFix | null }) {
  const text = status === "weak" && fix ? `GPS ±${Math.round(fix.accuracy)} m` : TEXT[status];
  return (
    <div className={styles.statusBar}>
      <span />
      <span
        className={[styles.gps, (status === "denied" || status === "weak") && styles.gpsBad].filter(Boolean).join(" ")}
        aria-live="polite"
      >
        {text}
      </span>
    </div>
  );
}
