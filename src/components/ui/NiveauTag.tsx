import { NIVEAUS, type Niveau } from "@/lib/niveau";
import styles from "./NiveauTag.module.css";

type NiveauTagProps = {
  niveau: Niveau;
  /** Just "Basis" instead of "Niveau: Basis", for tight tables. */
  short?: boolean;
  className?: string;
};

export function NiveauTag({ niveau, short = false, className }: NiveauTagProps) {
  return (
    <span
      className={[styles.tag, styles[niveau], className]
        .filter(Boolean)
        .join(" ")}
    >
      {short ? NIVEAUS[niveau].label : `Niveau: ${NIVEAUS[niveau].label}`}
    </span>
  );
}
