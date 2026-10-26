import styles from "./widgets.module.css";

/** How many spots the group has done. */
export function Voortgang({ done, total }: { done: number; total: number }) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className={styles.progress}>
      <div className={styles.progressText}>
        <span className={styles.progressLabel}>Voortgang</span>
        <span className={styles.progressValue}>
          {done} van {total}
        </span>
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label="Voortgang"
      >
        <div className={styles.bar} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
