import Link from "next/link";
import styles from "./StatusChip.module.css";

export type ChipStatus =
  | "vergrendeld"
  | "hier"
  | "opgelost"
  | "wacht"
  | "verdacht";

const LABELS: Record<ChipStatus, string> = {
  vergrendeld: "Vergrendeld",
  hier: "Je bent hier",
  opgelost: "Opgelost",
  wacht: "Wacht op leerkracht",
  verdacht: "Verdacht",
};

type StatusChipProps = {
  status: ChipStatus;
  /** Overrides the default text, e.g. "Klaar" or "Concept" on tour cards. */
  label?: string;
  /** The "Verdacht" chip links to the flag details on the teacher side. */
  href?: string;
  className?: string;
};

export function StatusChip({ status, label, href, className }: StatusChipProps) {
  const classes = [styles.chip, styles[status], className]
    .filter(Boolean)
    .join(" ");
  const text = label ?? LABELS[status];

  if (href) {
    return (
      <Link href={href} className={classes}>
        {text}
      </Link>
    );
  }
  return <span className={classes}>{text}</span>;
}
