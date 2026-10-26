"use server";

import { revalidatePath } from "next/cache";
import type { Json } from "@/lib/supabase/database.types";
import { isBlank, usedParams, validateQuestion, type QuestionDraft } from "@/lib/question";
import { createTeacherClient } from "@/lib/supabase/server";
import { LEVELS, NIVEAUS } from "@/lib/niveau";

/** Saves the three level versions of a spot. Blank levels are removed. */
export async function saveQuestions(
  tourId: string,
  spotId: string,
  drafts: QuestionDraft[],
): Promise<{ error?: string }> {
  for (const draft of drafts) {
    if (!LEVELS.includes(draft.level)) return { error: "Onbekend niveau." };
    if (isBlank(draft)) continue;
    const problem = validateQuestion(draft);
    if (problem) return { error: `${NIVEAUS[draft.level].label}: ${problem}` };
  }

  const supabase = await createTeacherClient();
  const filled = drafts.filter((d) => !isBlank(d));
  const blankLevels = drafts.filter(isBlank).map((d) => d.level);

  if (blankLevels.length > 0) {
    const { error } = await supabase
      .from("question")
      .delete()
      .eq("location_id", spotId)
      .eq("variant", 1)
      .in("level", blankLevels);
    if (error) return { error: "Opslaan mislukt." };
  }

  if (filled.length > 0) {
    const { error } = await supabase.from("question").upsert(
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

  revalidatePath("/leerkracht");
  revalidatePath(`/leerkracht/tochten/${tourId}`);
  return {};
}
