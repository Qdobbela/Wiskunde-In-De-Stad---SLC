import { notFound } from "next/navigation";
import { NiveauTag } from "@/components/ui/NiveauTag";
import { createTeacherClient } from "@/lib/supabase/server";
import { closeSession } from "./actions";
import { Button } from "@/components/ui/Button";
import layout from "../../teacher.module.css";
import styles from "./session.module.css";

export const metadata = { title: "Sessie · Wiskunde in de stad" };

export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const supabase = await createTeacherClient();
  const { data: session } = await supabase
    .from("session")
    .select("id, code, status, class_label, tour(title), team(id, name, level, member_first_names, created_at)")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) notFound();

  const teams = [...session.team].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const isLive = session.status === "live";

  return (
    <>
      <header className={layout.header}>
        <div className={layout.titleBlock}>
          <span className={layout.eyebrow}>
            {[session.class_label, isLive ? "Sessie loopt" : "Sessie afgesloten"].filter(Boolean).join(" · ")}
          </span>
          <h1 className={layout.title}>{session.tour?.title}</h1>
        </div>
        {isLive && (
          <form action={closeSession.bind(null, session.id)} className={layout.actions}>
            <Button type="submit" variant="outline">
              Sessie afsluiten
            </Button>
          </form>
        )}
      </header>

      <div className={styles.grid}>
        <section className={`${layout.panel} ${styles.codePanel}`}>
          <span className={layout.sectionLabel}>Sessiecode</span>
          <p className={styles.code} aria-label={`Code ${session.code.split("").join(" ")}`}>
            {session.code}
          </p>
          <p className={styles.instructions}>
            Laat de groepen deze code invullen op <strong>wiskunde in de stad</strong> op hun gsm.
          </p>
        </section>

        <section className={layout.panel}>
          <span className={layout.sectionLabel}>Groepen ({teams.length})</span>
          {teams.length === 0 ? (
            <p className={styles.empty}>Nog geen groepen. Ververs de pagina zodra groepen de code ingeven.</p>
          ) : (
            <ul className={styles.teams}>
              {teams.map((team) => (
                <li key={team.id} className={styles.team}>
                  <span className={styles.teamName}>{team.name}</span>
                  <span className={styles.members}>{team.member_first_names.join(", ")}</span>
                  <NiveauTag niveau={team.level} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
