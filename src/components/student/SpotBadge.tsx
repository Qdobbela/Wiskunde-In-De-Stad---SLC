import styles from "./widgets.module.css";

/** "SPOT 4/12", placed as a sticker at -3°. */
export function SpotBadge({ current, total }: { current: number; total: number }) {
  return (
    <span className={styles.spotBadge} aria-label={`Spot ${current} van ${total}`}>
      SPOT {current}/{total}
    </span>
  );
}
