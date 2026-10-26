"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { JoinQr } from "@/components/teacher/JoinQr";
import { ButtonLink } from "@/components/ui/Button";
import { BASE_PATH } from "@/lib/basePath";
import { supabase } from "@/lib/supabase/client";
import { clock } from "@/lib/teacher/format";
import { isRunning } from "@/lib/teacher/queries";
import { useRealtime } from "@/lib/teacher/useRealtime";
import { must, useLoad } from "@/lib/useLoad";
import layout from "../teacher.module.css";
import styles from "./session.module.css";

/** The session code, big enough for the projector, with groups joining live. */
function Session() {
  const id = useSearchParams().get("id") ?? "";
  const { data: session, error, reload } = useLoad(
    async () =>
      must(
        await supabase()
          .from("session")
          .select("id, code, status, class_label, ends_at, tour(title, location(id)), team(id, name, member_first_names, start_index, created_at)")
          .eq("id", id)
          .single(),
      ),
    [id],
  );
  useRealtime(`sessie-${id}`, [{ table: "team", filter: `session_id=eq.${id}` }], reload, 300);

  if (error) return <p className={layout.error}>{error}</p>;
  if (!session) return <p className={layout.loading}>Laden…</p>;

  const teams = [...session.team].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const spotCount = session.tour?.location.length ?? 0;
  const running = isRunning(session);
  const url = `${window.location.host}${BASE_PATH}`;

  return (
    <>
      <header className={layout.header}>
        <div className={layout.titleBlock}>
          <span className={layout.eyebrow}>
            {[session.class_label, running ? (session.ends_at ? `Loopt tot ${clock(session.ends_at)}` : "Sessie loopt") : "Sessie afgelopen"]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <h1 className={layout.title}>{session.tour?.title}</h1>
        </div>
        <div className={layout.actions}>
          <ButtonLink href={`/leerkracht/live/?sessie=${session.id}`}>Naar live kaart</ButtonLink>
        </div>
      </header>

      <div className={styles.grid}>
        <section className={`${layout.panel} ${styles.codePanel}`}>
          <div className={styles.joinRow}>
            <div className={styles.joinCode}>
              <span className={layout.sectionLabel}>Sessiecode</span>
              <p className={styles.code} aria-label={`Code ${session.code.split("").join(" ")}`}>
                {session.code}
              </p>
            </div>
            <div className={styles.joinQr}>
              <span className={layout.sectionLabel}>Of scan</span>
              <JoinQr code={session.code} />
            </div>
          </div>
          <p className={styles.instructions}>
            Elke groep scant de QR-code met één gsm, of surft naar <strong>{url}</strong> en vult de code in.
          </p>
        </section>

        <section className={layout.panel}>
          <span className={layout.sectionLabel}>Groepen ({teams.length})</span>
          {teams.length === 0 ? (
            <p className={styles.empty}>Nog geen groepen. Groepen verschijnen hier zodra ze meedoen.</p>
          ) : (
            <ul className={styles.teams}>
              {teams.map((team) => (
                <li key={team.id} className={styles.team}>
                  <span className={styles.teamText}>
                    <span className={styles.teamName}>{team.name}</span>
                    <span className={styles.members}>{team.member_first_names.join(", ")}</span>
                  </span>
                  {spotCount > 0 && <span className={styles.start}>start bij spot {(team.start_index % spotCount) + 1}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

export default function SessionPage() {
  return (
    <Suspense>
      <Session />
    </Suspense>
  );
}
