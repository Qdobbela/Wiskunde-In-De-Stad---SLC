"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { NiveauTag } from "@/components/ui/NiveauTag";
import { StatusChip } from "@/components/ui/StatusChip";
import { formatDutchNumber, parseDutchNumber } from "@/lib/number";
import styles from "./componenten.module.css";

/** Dev page that shows every base component in each state. */
export default function ComponentenPage() {
  const [answer, setAnswer] = useState("31,8");
  const parsed = parseDutchNumber(answer);

  return (
    <main className={styles.main}>
      <h1>Componenten</h1>

      <section className={styles.section}>
        <h3>Button</h3>
        <Button>Start de tocht</Button>
        <Button disabled>Start de tocht</Button>
        <Button variant="secondary">Neem foto</Button>
        <Button variant="secondary" disabled>
          Neem foto
        </Button>
        <Button variant="outline">Terug</Button>
        <Button variant="outline" disabled>
          Terug
        </Button>
      </section>

      <section className={styles.section}>
        <h3>Status chip</h3>
        <div className={styles.row}>
          <StatusChip status="vergrendeld" />
          <StatusChip status="hier" />
          <StatusChip status="opgelost" />
          <StatusChip status="wacht" />
          <StatusChip status="verdacht" href="#" />
        </div>
      </section>

      <section className={styles.section}>
        <h3>Niveau tag</h3>
        <div className={styles.row}>
          <NiveauTag niveau="basis" />
          <NiveauTag niveau="gevorderd" />
          <NiveauTag niveau="expert" />
        </div>
      </section>

      <section className={styles.section}>
        <h3>Invoerveld</h3>
        <Input label="Groepsnaam" placeholder="De Gravensteeners" />
        <Input label="Jullie antwoord" numeric unit="m" placeholder="0" hint="Gebruik een komma voor decimalen" />
        <Input
          label="Jullie antwoord"
          numeric
          unit="m"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          hint={parsed !== null ? `Gelezen als ${formatDutchNumber(parsed)}` : undefined}
          error={parsed === null ? "Gebruik een komma voor decimalen" : undefined}
        />
        <Input label="Jullie antwoord" numeric unit="m" value="31.8" readOnly error="Gebruik een komma voor decimalen" />
      </section>
    </main>
  );
}
