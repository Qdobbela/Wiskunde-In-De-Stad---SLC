import { NiveauTag } from "@/components/ui/NiveauTag";
import { NIVEAUS, type Niveau } from "@/lib/niveau";
import { formatDutchNumber } from "@/lib/number";
import common from "./student.module.css";
import styles from "./levels.module.css";

const LEVEL_TEXT: Record<Niveau, string> = {
  basis: "Rekenen met wat je ziet. Tellen, schatten, eenvoudige formules.",
  gevorderd: "Schaal, oppervlakte en procenten. Meerdere stappen.",
  expert: "Pythagoras, hoeken en verbanden. Voor wie wil zweten.",
};

type LevelCardsProps = {
  options: { level: Niveau; maxPoints?: number; needsPhoto?: boolean }[];
  value: Niveau | null;
  onChange: (level: Niveau) => void;
};

/** The three level options from L03, as a radio group. */
export function LevelCards({ options, value, onChange }: LevelCardsProps) {
  return (
    <div role="radiogroup" aria-label="Niveau" className={styles.levels}>
      {options.map(({ level, maxPoints, needsPhoto }) => {
        const chosen = value === level;
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={chosen}
            className={[styles.level, chosen && styles.levelChosen].filter(Boolean).join(" ")}
            onClick={() => onChange(level)}
          >
            <span className={styles.levelHead}>
              <NiveauTag niveau={level} />
              <span className={styles.multiplier}>
                {maxPoints !== undefined ? `${maxPoints} punten` : `x${formatDutchNumber(NIVEAUS[level].multiplier)} punten`}
              </span>
            </span>
            <span className={common.body}>
              {LEVEL_TEXT[level]}
              {needsPhoto ? " Met foto-opdracht." : ""}
            </span>
            {chosen && <span className={styles.chosen}>Gekozen</span>}
          </button>
        );
      })}
    </div>
  );
}
