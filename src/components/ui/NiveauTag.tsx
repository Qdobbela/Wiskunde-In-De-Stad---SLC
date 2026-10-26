import { NIVEAUS, type Niveau } from "@/lib/niveau";
import styles from "./NiveauTag.module.css";

type NiveauTagProps = {
  niveau: Niveau;
  className?: string;
};

export function NiveauTag({ niveau, className }: NiveauTagProps) {
  return (
    <span
      className={[styles.tag, styles[niveau], className]
        .filter(Boolean)
        .join(" ")}
    >
      Niveau: {NIVEAUS[niveau].label}
    </span>
  );
}
