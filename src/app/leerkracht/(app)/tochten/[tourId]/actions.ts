"use server";

import { revalidatePath } from "next/cache";
import { createTeacherClient } from "@/lib/supabase/server";

export type SpotInput = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  dwell_s: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validate(title: string, spots: SpotInput[]): string | null {
  if (!title.trim()) return "Geef de tocht een naam.";
  for (const [i, s] of spots.entries()) {
    const label = s.name.trim() || `Spot ${i + 1}`;
    if (!UUID.test(s.id)) return `${label}: ongeldige id.`;
    if (!s.name.trim()) return `Spot ${i + 1} heeft nog geen naam.`;
    if (!(s.radius_m >= 5 && s.radius_m <= 500)) return `${label}: straal moet tussen 5 en 500 m liggen.`;
    if (!(s.dwell_s >= 0 && s.dwell_s <= 600)) return `${label}: blijftijd moet tussen 0 en 600 sec liggen.`;
    if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) return `${label}: ongeldige coördinaten.`;
  }
  return null;
}

/**
 * Saves the title and the full spot list. Spots missing from the list are
 * deleted (with their questions). The list order becomes the route order.
 */
export async function saveTour(
  tourId: string,
  title: string,
  spots: SpotInput[],
): Promise<{ error?: string }> {
  const problem = validate(title, spots);
  if (problem) return { error: problem };

  const supabase = await createTeacherClient();

  const { error: titleError } = await supabase
    .from("tour")
    .update({ title: title.trim() })
    .eq("id", tourId);
  if (titleError) return { error: "Opslaan mislukt." };

  const { data: existing, error: listError } = await supabase
    .from("location")
    .select("id")
    .eq("tour_id", tourId);
  if (listError) return { error: "Opslaan mislukt." };

  const keep = new Set(spots.map((s) => s.id));
  const removed = existing.map((l) => l.id).filter((id) => !keep.has(id));
  if (removed.length > 0) {
    const { error } = await supabase.from("location").delete().in("id", removed);
    if (error) return { error: "Verwijderen van spots mislukt." };
  }

  if (spots.length > 0) {
    // One statement, so the deferred (tour_id, position) check sees the final order.
    const { error } = await supabase.from("location").upsert(
      spots.map((s, i) => ({
        id: s.id,
        tour_id: tourId,
        position: i + 1,
        name: s.name.trim(),
        lat: s.lat,
        lng: s.lng,
        radius_m: Math.round(s.radius_m),
        dwell_s: Math.round(s.dwell_s),
      })),
    );
    if (error) return { error: "Opslaan van spots mislukt." };
  }

  revalidatePath("/leerkracht");
  revalidatePath(`/leerkracht/tochten/${tourId}`);
  return {};
}

export async function deleteTour(tourId: string): Promise<{ error?: string }> {
  const supabase = await createTeacherClient();
  const { error } = await supabase.from("tour").delete().eq("id", tourId);
  if (error) return { error: "Verwijderen mislukt." };
  revalidatePath("/leerkracht");
  return {};
}
