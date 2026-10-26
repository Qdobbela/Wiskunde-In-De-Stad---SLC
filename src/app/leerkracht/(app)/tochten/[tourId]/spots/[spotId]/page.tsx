import { notFound } from "next/navigation";
import type { Params } from "@/lib/formula";
import { emptyDraft, type QuestionDraft } from "@/lib/question";
import { createTeacherClient } from "@/lib/supabase/server";
import { LEVELS } from "@/lib/teacher/data";
import { QuestionEditor } from "./QuestionEditor";

export const metadata = { title: "Vragen · Wiskunde in de stad" };

export default async function SpotQuestionsPage({
  params,
}: {
  params: Promise<{ tourId: string; spotId: string }>;
}) {
  const { tourId, spotId } = await params;
  const supabase = await createTeacherClient();

  const [{ data: spot }, { data: siblings }] = await Promise.all([
    supabase
      .from("location")
      .select("id, name, position, tour_id, question(*)")
      .eq("id", spotId)
      .eq("tour_id", tourId)
      .maybeSingle(),
    supabase.from("location").select("id, position").eq("tour_id", tourId).order("position"),
  ]);
  if (!spot) notFound();

  const drafts = Object.fromEntries(
    LEVELS.map((level) => {
      const q = spot.question.find((x) => x.level === level && x.variant === 1);
      const draft: QuestionDraft = q
        ? {
            level,
            body: q.body,
            answer_type: q.answer_type,
            correct_value: q.correct_value ?? "",
            tolerance: Number(q.tolerance),
            unit: q.unit ?? "",
            base_points: q.base_points,
            params: (q.params ?? {}) as Params,
            needs_photo: q.needs_photo,
            photo_prompt: q.photo_prompt ?? "",
            time_limit_s: q.time_limit_s,
          }
        : emptyDraft(level);
      return [level, draft];
    }),
  ) as Record<(typeof LEVELS)[number], QuestionDraft>;

  const index = (siblings ?? []).findIndex((s) => s.id === spot.id);
  const prev = index > 0 ? siblings![index - 1].id : null;
  const next = index >= 0 && index < (siblings?.length ?? 0) - 1 ? siblings![index + 1].id : null;

  return (
    <QuestionEditor
      key={spot.id}
      tourId={tourId}
      spotId={spot.id}
      spotName={spot.name}
      spotNumber={spot.position}
      initialDrafts={drafts}
      prevSpotId={prev}
      nextSpotId={next}
    />
  );
}
