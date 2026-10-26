/** "Quinten Dobbelaere" → "Q. Dobbelaere" */
export function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

/** "3 okt" */
export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("nl-BE", { day: "numeric", month: "short" }).replace(".", "");
}

/** "3 oktober" */
export function longDate(iso: string) {
  return new Date(iso).toLocaleDateString("nl-BE", { day: "numeric", month: "long" });
}

/** "10:42" */
export function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });
}

/** 6480 s → "1:48" */
export function hoursMinutes(seconds: number) {
  const m = Math.round(seconds / 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}
