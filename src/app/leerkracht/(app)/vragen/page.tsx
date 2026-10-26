"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { Params } from "@/lib/formula";
import { LEVELS, type Niveau } from "@/lib/niveau";
import { emptyDraft, type QuestionDraft } from "@/lib/question";
import { supabase } from "@/lib/supabase/client";
import { must, useLoad } from "@/lib/useLoad";
import { QuestionEditor } from "./QuestionEditor";
import layout from "../teacher.module.css";

function Questions() {
  const spotId = useSearchParams().get("spot") ?? "";
  const { data, error } = useLoad(async () => {
    const spot = must(
      await supabase().from("location").select("id, name, position, tour_id, question(*)").eq("id", spotId).maybeSingle(),
    );
    if (!spot) throw new Error("Deze spot bestaat niet (meer).");
    const siblings = must(
      await supabase().from("location").select("id, position").eq("tour_id", spot.tour_id).order("position"),
    );
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
    ) as Record<Niveau, QuestionDraft>;
    const index = siblings.findIndex((s) => s.id === spot.id);
    return {
      spot,
      drafts,
      prev: index > 0 ? siblings[index - 1].id : null,
      next: index >= 0 && index < siblings.length - 1 ? siblings[index + 1].id : null,
    };
  }, [spotId]);

  if (error) return <p className={layout.error}>{error}</p>;
  if (!data) return <p className={layout.loading}>Laden…</p>;
  return (
    <QuestionEditor
      key={data.spot.id}
      tourId={data.spot.tour_id}
      spotId={data.spot.id}
      spotName={data.spot.name}
      spotNumber={data.spot.position}
      initialDrafts={data.drafts}
      prevSpotId={data.prev}
      nextSpotId={data.next}
    />
  );
}

/** T03 Vragen. */
export default function QuestionsPage() {
  return (
    <Suspense>
      <Questions />
    </Suspense>
  );
}
