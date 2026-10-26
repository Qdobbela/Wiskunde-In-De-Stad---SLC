/**
 * Parses a number typed by a student. Only a decimal comma is valid
 * ("31,8" means 31.8). A point is rejected, as in the Figma "Fout" state,
 * because "1.250" could mean 1250 or 1,25.
 * Returns null when the input isn't a plain number.
 */
export function parseDutchNumber(input: string): number | null {
  const cleaned = input.trim().replace(/\s+/g, "").replace(/^−/, "-");
  if (!/^-?\d+(,\d+)?$/.test(cleaned)) return null;
  return Number(cleaned.replace(",", "."));
}

/** Formats a number with a decimal comma, for display. */
export function formatDutchNumber(value: number, maxDecimals = 2): string {
  return value.toLocaleString("nl-BE", {
    maximumFractionDigits: maxDecimals,
    useGrouping: false,
  });
}
