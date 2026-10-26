import type { ReactNode } from "react";
import styles from "./Sticker.module.css";

type StickerProps = {
  children: ReactNode;
  /** Rotation in degrees. The style uses small tilts (about -5° to 3°). */
  rotate?: number;
  tone?: "lime" | "dark";
  className?: string;
};

/** Rotated label with a hard shadow, e.g. the "Wiskunde in de stad" logo. */
export function Sticker({ children, rotate = 3, tone = "lime", className }: StickerProps) {
  return (
    <span
      className={[styles.sticker, styles[tone], className].filter(Boolean).join(" ")}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </span>
  );
}
