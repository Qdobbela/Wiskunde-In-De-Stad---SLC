import styles from "./Kaartpin.module.css";

export type PinStatus = "vergrendeld" | "hier" | "opgelost" | "groep";

type KaartpinProps = {
  status: PinStatus;
  label: string | number;
  size?: "m" | "s";
  className?: string;
};

export function kaartpinClassName(status: PinStatus, size: "m" | "s" = "m") {
  return [styles.pin, styles[status], size === "s" && styles.small].filter(Boolean).join(" ");
}

export const kaartpinDraggableClass = styles.draggable;

export function Kaartpin({ status, label, size = "m", className }: KaartpinProps) {
  return (
    <span className={[kaartpinClassName(status, size), className].filter(Boolean).join(" ")}>
      {label}
    </span>
  );
}
