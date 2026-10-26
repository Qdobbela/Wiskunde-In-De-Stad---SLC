"use client";

import Link from "next/link";
import { NiveauTag } from "@/components/ui/NiveauTag";
import { LEVELS } from "@/lib/niveau";
import { supabase } from "@/lib/supabase/client";
import { must, useLoad } from "@/lib/useLoad";
import layout from "../teacher.module.css";
import styles from "./vragenbank.module.css";

/** All questions of all tours, per spot. Click a spot to edit its questions. */
export default function QuestionBankPage() {
  const { data } = useLoad(
    async () =>
      must(
        await supabase()
          .from("tour")
          .select("id, title, location(id, position, name, question(id, level, body, answer_type, needs_photo, base_points))")
          .order("created_at", { ascending: false }),
      ),
    [],
  );

  return (
    <>
      <header className={layout.header}>
        <div className={layout.titleBlock}>
          <span className={layout.eyebrow}>Alle vragen</span>
          <h1 className={layout.title}>Vragenbank</h1>
        </div>
      </header>
      {!data && <p className={layout.loading}>Laden…</p>}
      {data?.length === 0 && <p className={layout.panel}>Nog geen vragen. Maak eerst een tocht.</p>}
      {data?.map((tour) => (
        <section key={tour.id} className={layout.panel}>
          <h2 className={styles.tour}>
            <Link href={`/leerkracht/tocht/?id=${tour.id}`}>{tour.title}</Link>
          </h2>
          {[...tour.location]
            .sort((a, b) => a.position - b.position)
            .map((spot) => (
              <Link key={spot.id} href={`/leerkracht/vragen/?spot=${spot.id}`} className={styles.spot}>
                <span className={styles.spotName}>
                  {spot.position}. {spot.name}
                </span>
                <span className={styles.questions}>
                  {LEVELS.map((level) => {
                    const q = spot.question.find((x) => x.level === level);
                    return (
                      <span key={level} className={styles.question}>
                        <NiveauTag niveau={level} />
                        <span className={q ? undefined : styles.missing}>
                          {q ? `${q.body.slice(0, 90)}${q.body.length > 90 ? "…" : ""}${q.needs_photo ? " 📷" : ""}` : "Nog geen vraag"}
                        </span>
                      </span>
                    );
                  })}
                </span>
              </Link>
            ))}
        </section>
      ))}
    </>
  );
}
