"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { NiveauTag } from "@/components/ui/NiveauTag";
import { Pills } from "@/components/ui/Pills";
import { evaluate, pickValues, renderBody, type Params } from "@/lib/formula";
import { LEVELS, NIVEAUS, type Niveau } from "@/lib/niveau";
import { formatDutchNumber } from "@/lib/number";
import { seededRandom } from "@/lib/question";
import { supabase } from "@/lib/supabase/client";
import { must, useLoad } from "@/lib/useLoad";
import layout from "../teacher.module.css";
import styles from "./voorbeeld.module.css";

/** "Bekijk als leerling": every spot as a group of the chosen level sees it. */
function Preview() {
  const tourId = useSearchParams().get("tocht") ?? "";
  const [level, setLevel] = useState<Niveau>("basis");
  const [group, setGroup] = useState(1);
  const { data: tour } = useLoad(
    async () =>
      must(
        await supabase()
          .from("tour")
          .select("id, title, location(id, position, name, question(level, body, answer_type, correct_value, unit, params, needs_photo, photo_prompt, base_points))")
          .eq("id", tourId)
          .single(),
      ),
    [tourId],
  );

  if (!tour) return <p className={layout.loading}>Laden…</p>;
  const spots = [...tour.location].sort((a, b) => a.position - b.position);

  return (
    <>
      <header className={layout.header}>
        <div className={layout.titleBlock}>
          <span className={layout.eyebrow}>Bekijk als leerling</span>
          <h1 className={layout.title}>{tour.title}</h1>
        </div>
        <div className={layout.actions}>
          <ButtonLink variant="outline" href={`/leerkracht/tocht/?id=${tour.id}`}>
            Terug naar tocht
          </ButtonLink>
        </div>
      </header>
      <div className={styles.controls}>
        <Pills label="Niveau" value={level} onChange={setLevel} options={LEVELS.map((l) => ({ value: l, label: NIVEAUS[l].label }))} />
        <button type="button" className={styles.reroll} onClick={() => setGroup((g) => g + 1)}>
          Andere getallen (groep {group})
        </button>
      </div>
      <div className={styles.phones}>
        {spots.map((spot) => {
          const q = spot.question.find((x) => x.level === level);
          const values = pickValues((q?.params ?? {}) as Params, seededRandom(group * 7919 + spot.position));
          let answer = "";
          if (q?.answer_type === "number" && q.correct_value) {
            try {
              answer = `Juist: ${formatDutchNumber(evaluate(q.correct_value, values))}${q.unit ? ` ${q.unit}` : ""}`;
            } catch {
              answer = "Formule klopt niet";
            }
          } else if (q?.answer_type === "text") {
            answer = `Juist: ${q.correct_value?.split("|").join(" of ")}`;
          }
          return (
            <div key={spot.id} className={styles.phone}>
              <span className={layout.sectionLabel}>Spot {spot.position} · jullie staan aan</span>
              <p className={styles.spotName}>{spot.name}</p>
              <div className={styles.card}>
                <NiveauTag niveau={level} />
                {q ? (
                  <>
                    <p>{renderBody(q.body, values)}</p>
                    {q.answer_type !== "photo" && (
                      <Input label="Jullie antwoord" numeric={q.answer_type === "number"} unit={q.unit ?? undefined} readOnly placeholder={q.answer_type === "number" ? "0" : ""} hint={answer} />
                    )}
                    {(q.needs_photo || q.answer_type === "photo") && <p className={styles.photo}>Foto: {q.photo_prompt || "met de live camera"}</p>}
                    <p className={styles.points}>{Math.round(q.base_points * NIVEAUS[level].multiplier)} punten</p>
                  </>
                ) : (
                  <p className={styles.missing}>Nog geen vraag voor dit niveau. Groepen krijgen dan een vraag van een ander niveau.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function PreviewPage() {
  return (
    <Suspense>
      <Preview />
    </Suspense>
  );
}
