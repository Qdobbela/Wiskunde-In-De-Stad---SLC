import styles from "./Pills.module.css";

type PillsProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
};

/** Pill-shaped single choice, e.g. the level and answer-type tabs on T03. */
export function Pills<T extends string>({ options, value, onChange, label }: PillsProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={styles.pills}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={[styles.pill, active && styles.active].filter(Boolean).join(" ")}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
