import { useId, type InputHTMLAttributes } from "react";
import styles from "./Input.module.css";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  type?: "text" | "email" | "password";
  /** Opens the numeric keyboard (with a comma key) and uses Space Mono. */
  numeric?: boolean;
  unit?: string;
  hint?: string;
  /** Shows the "Fout" state. Replaces the hint. */
  error?: string;
};

export function Input({
  label,
  type = "text",
  numeric = false,
  unit,
  hint,
  error,
  className,
  id,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;

  return (
    <div
      className={[styles.field, error && styles.error, className]
        .filter(Boolean)
        .join(" ")}
    >
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <div className={styles.box}>
        <input
          id={inputId}
          type={type}
          inputMode={numeric ? "decimal" : undefined}
          autoComplete={type === "text" ? "off" : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className={[styles.input, numeric && styles.numeric]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />
        {unit && <span className={styles.unit}>{unit}</span>}
      </div>
      {message && (
        <p id={messageId} className={styles.hint} role={error ? "alert" : undefined}>
          {message}
        </p>
      )}
    </div>
  );
}
