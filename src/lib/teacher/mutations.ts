"use client";

import type { Json } from "@/lib/supabase/database.types";
import { supabase } from "@/lib/supabase/client";
import { isBlank, usedParams, validateQuestion, type QuestionDraft } from "@/lib/question";
import { LEVELS, NIVEAUS } from "@/lib/niveau";

/**
 * Everything a teacher changes, straight from the browser. RLS makes sure a
 * teacher can only touch their own tours and sessions; answers can only get a
 * review (database trigger), never a changed value.
 */

type Result = { error?: string };

async function userId() {
  const { data } = await supabase().auth.getUser();
  if (!data.user) throw new Error("Niet aangemeld");
  return data.user.id;
}

export async function createTour(): Promise<string> {
  const { data, error } = await supabase()
    .from("tour")
    .insert({ teacher_id: await userId(), title: "Nieuwe tocht" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export type SpotInput = { id: string; name: string; lat: number; lng: number; radius_m: number; dwell_s: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateSpots(title: string, spots: SpotInput[]): string | null {
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

/** Saves the title and the full spot list; missing spots are deleted. */
export async function saveTour(tourId: string, title: string, spots: SpotInput[]): Promise<Result> {
  const problem = validateSpots(title, spots);
  if (problem) return { error: problem };
  const db = supabase();

  const { error: titleError } = await db.from("tour").update({ title: title.trim() }).eq("id", tourId);
  if (titleError) return { error: "Opslaan mislukt." };

  const { data: existing, error: listError } = await db.from("location").select("id").eq("tour_id", tourId);
  if (listError) return { error: "Opslaan mislukt." };
  const keep = new Set(spots.map((s) => s.id));
  const removed = existing.map((l) => l.id).filter((id) => !keep.has(id));
  if (removed.length > 0) {
    const { error } = await db.from("location").delete().in("id", removed);
    if (error) return { error: "Verwijderen van spots mislukt." };
  }
  if (spots.length > 0) {
    // One statement, so the deferred (tour_id, position) check sees the final order.
    const { error } = await db.from("location").upsert(
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
  return {};
}

export async function deleteTour(tourId: string): Promise<Result> {
  const { error } = await supabase().from("tour").delete().eq("id", tourId);
  return error ? { error: "Verwijderen mislukt." } : {};
}

/** Saves the three level versions of a spot. Blank levels are removed. */
export async function saveQuestions(spotId: string, drafts: QuestionDraft[]): Promise<Result> {
  for (const draft of drafts) {
    if (!LEVELS.includes(draft.level)) return { error: "Onbekend niveau." };
    if (isBlank(draft)) continue;
    const problem = validateQuestion(draft);
    if (problem) return { error: `${NIVEAUS[draft.level].label}: ${problem}` };
  }
  const db = supabase();
  const blankLevels = drafts.filter(isBlank).map((d) => d.level);
  if (blankLevels.length > 0) {
    const { error } = await db
      .from("question")
      .delete()
      .eq("location_id", spotId)
      .eq("variant", 1)
      .in("level", blankLevels);
    if (error) return { error: "Opslaan mislukt." };
  }
  const filled = drafts.filter((d) => !isBlank(d));
  if (filled.length > 0) {
    const { error } = await db.from("question").upsert(
      filled.map((d) => {
        const isPhoto = d.answer_type === "photo";
        return {
          location_id: spotId,
          level: d.level,
          variant: 1,
          body: d.body.trim(),
          answer_type: d.answer_type,
          correct_value: isPhoto ? null : d.correct_value.trim(),
          tolerance: d.answer_type === "number" ? d.tolerance : 0,
          unit: d.answer_type === "number" ? d.unit.trim() || null : null,
          base_points: d.base_points,
          params: usedParams(d) as Json,
          needs_photo: isPhoto || d.needs_photo,
          photo_prompt: isPhoto || d.needs_photo ? d.photo_prompt.trim() || null : null,
          time_limit_s: d.time_limit_s,
        };
      }),
      { onConflict: "location_id,level,variant" },
    );
    if (error) return { error: "Opslaan mislukt." };
  }
  return {};
}

export async function startSession(tourId: string, classLabel: string, minutes: number): Promise<string> {
  const duration = Number.isFinite(minutes) ? Math.min(Math.max(Math.round(minutes), 15), 8 * 60) : 120;
  const now = Date.now();
  const { data, error } = await supabase()
    .from("session")
    .insert({
      tour_id: tourId,
      class_label: classLabel.trim().slice(0, 20),
      status: "live",
      starts_at: new Date(now).toISOString(),
      ends_at: new Date(now + duration * 60_000).toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function closeSession(sessionId: string): Promise<Result> {
  const { error } = await supabase()
    .from("session")
    .update({ status: "closed", ends_at: new Date().toISOString() })
    .eq("id", sessionId);
  return error ? { error: "Afsluiten mislukt." } : {};
}

/** "Bericht aan iedereen": every group sees it on their phone. */
export async function sendMessage(sessionId: string, body: string): Promise<Result> {
  const text = body.trim();
  if (!text) return { error: "Typ eerst een bericht." };
  const { error } = await supabase().from("session_message").insert({ session_id: sessionId, body: text.slice(0, 280) });
  return error ? { error: "Versturen mislukt." } : {};
}

/** "Negeer": the flag stays in the log, but no longer blocks the group. */
export async function resolveFlag(flagId: string): Promise<Result> {
  const { error } = await supabase()
    .from("flag")
    .update({ resolved_at: new Date().toISOString(), resolved_by: await userId() })
    .eq("id", flagId);
  return error ? { error: "Opslaan mislukt." } : {};
}

/** T05 photo review: 0, half or full points. */
export async function reviewAnswer(answerId: string, score: 0 | 0.5 | 1): Promise<Result> {
  const { error } = await supabase()
    .from("answer")
    .update({ teacher_score: score, reviewed_at: new Date().toISOString(), reviewed_by: await userId() })
    .eq("id", answerId);
  return error ? { error: "Opslaan mislukt." } : {};
}

/** Lets a group continue on another phone (it re-joins with its group name). */
export async function releasePhone(teamId: string): Promise<Result> {
  const { error } = await supabase().from("team").update({ device_id: null }).eq("id", teamId);
  return error ? { error: "Lukte niet." } : {};
}

export async function updateProfile(name: string, school: string): Promise<Result> {
  const { error } = await supabase()
    .from("teacher")
    .update({ name: name.trim(), school: school.trim() })
    .eq("id", await userId());
  return error ? { error: "Opslaan mislukt." } : {};
}
