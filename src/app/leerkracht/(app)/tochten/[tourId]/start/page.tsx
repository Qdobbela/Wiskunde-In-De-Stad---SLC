import { notFound } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createTeacherClient } from "@/lib/supabase/server";
import { startSession } from "../../../actions";
import layout from "../../../teacher.module.css";
import styles from "./start.module.css";

export const metadata = { title: "Sessie starten · Wiskunde in de stad" };

export default async function StartSessionPage({ params }: { params: Promise<{ tourId: string }> }) {
  const { tourId } = await params;
  const supabase = await createTeacherClient();
  const { data: tour } = await supabase
    .from("tour")
    .select("id, title, location(id)")
    .eq("id", tourId)
    .maybeSingle();
  if (!tour) notFound();

  return (
    <>
      <header className={layout.header}>
        <div className={layout.titleBlock}>
          <span className={layout.eyebrow}>Sessie starten</span>
          <h1 className={layout.title}>{tour.title}</h1>
        </div>
      </header>
      <form action={startSession.bind(null, tour.id)} className={`${layout.panel} ${styles.form}`}>
        <p>
          {tour.location.length} spots. Na het starten krijg je een code die de groepen op hun gsm
          invullen.
        </p>
        <Input label="Klas" name="class_label" placeholder="2B" maxLength={20} hint="Zie je later terug bij de resultaten." />
        <div className={styles.buttons}>
          <ButtonLink href="/leerkracht" variant="outline">
            Annuleren
          </ButtonLink>
          <Button type="submit">Start sessie</Button>
        </div>
      </form>
    </>
  );
}
