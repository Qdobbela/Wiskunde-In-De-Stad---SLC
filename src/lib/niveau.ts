export type Niveau = "basis" | "gevorderd" | "expert";

export const LEVELS: Niveau[] = ["basis", "gevorderd", "expert"];

export const NIVEAUS: Record<Niveau, { label: string; multiplier: number }> = {
  basis: { label: "Basis", multiplier: 1 },
  gevorderd: { label: "Gevorderd", multiplier: 1.5 },
  expert: { label: "Expert", multiplier: 2 },
};
