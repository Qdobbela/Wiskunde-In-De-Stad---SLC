"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { parseDutchNumber } from "@/lib/number";
import { supabase } from "@/lib/supabase/client";
import { startSession } from "@/lib/teacher/mutations";
import { must, useLoad } from "@/lib/useLoad";
import layout from "../teacher.module.css";
import styles from "./start.module.css";

function Start() {
  const router = useRouter();
  const tourId = useSearchParams().get("tocht") ?? "";
  const [classLabel, setClassLabel] = useState("");
  const [duration, setDuration] = useState("120");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: tour } = useLoad(
    async () => must(await supabase().from("tour").select("id, title, location(id)").eq("id", tourId).single()),
    [tourId],
  );

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const id = await startSession(tourId, classLabel, parseDutchNumber(duration) ?? 120);
      router.push(`/leerkracht/sessie/?id=${id}`);
    } catch {
      setError("Starten mislukt. Probeer opnieuw.");
      setPending(false);
    }
  }

  if (!tour) return <p className={layout.loading}>Laden…</p>;
  return (
    <>
      <header className={layout.header}>
        <div className={layout.titleBlock}>
          <span className={layout.eyebrow}>Sessie starten</span>
          <h1 className={layout.title}>{tour.title}</h1>
        </div>
      </header>
      <form onSubmit={start} className={`${layout.panel} ${styles.form}`}>
        <p>{tour.location.length} spots. Na het starten krijg je een code die de groepen op hun gsm invullen.</p>
        <Input label="Klas" value={classLabel} onChange={(e) => setClassLabel(e.target.value)} placeholder="2B" maxLength={20} hint="Zie je later terug bij de resultaten." />
        <Input label="Duur" numeric unit="min" value={duration} onChange={(e) => setDuration(e.target.value)} hint="De groepen zien hoeveel tijd ze nog hebben." />
        {error && <p className={layout.error}>{error}</p>}
        <div className={styles.buttons}>
          <ButtonLink href="/leerkracht/" variant="outline">
            Annuleren
          </ButtonLink>
          <Button type="submit" disabled={pending}>
            Start sessie
          </Button>
        </div>
      </form>
    </>
  );
}

export default function StartPage() {
  return (
    <Suspense>
      <Start />
    </Suspense>
  );
}
