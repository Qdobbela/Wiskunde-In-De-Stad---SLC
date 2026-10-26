"use client";

import { Voortgang } from "@/components/student/Voortgang";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { Sticker } from "@/components/ui/Sticker";
import { NIVEAUS, type Niveau } from "@/lib/niveau";
import { formatDutchNumber } from "@/lib/number";
import type { AnswerResult } from "@/lib/student/api";
import common from "@/components/student/student.module.css";
import styles from "./result.module.css";

type ResultViewProps = {
  result: AnswerResult;
  spotName: string;
  level: Niveau;
  done: number;
  total: number;
  nextNumber: number | null;
  onNext: () => void;
};

const clock = (iso: string) => new Date(iso).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });

/** L09: right, wrong, or waiting for the teacher (photo questions). */
export function ResultView({ result, spotName, level, done, total, nextNumber, onNext }: ResultViewProps) {
  const tone = result.pending ? "pending" : result.correct ? "correct" : "wrong";
  const multiplier = NIVEAUS[level].multiplier;
  const praise =
    tone === "pending"
      ? "Je leerkracht kijkt de foto na. Daarna krijgen jullie de punten."
      : tone === "correct"
        ? multiplier === 2
          ? "Expert-niveau telt dubbel. Mooi gerekend!"
          : multiplier === 1.5
            ? "Gevorderd telt anderhalf keer. Mooi gerekend!"
            : "Mooi gerekend!"
        : `Het juiste antwoord was ${
            typeof result.expected === "number" ? formatDutchNumber(result.expected) : result.expected ?? "anders"
          }${result.unit && typeof result.expected === "number" ? ` ${result.unit}` : ""}.`;
  const value = result.value ? `${result.value}${result.unit ? ` ${result.unit}` : ""}` : "Foto";

  return (
    <main className={`${common.screen} ${styles[tone]}`}>
      <div className={styles.statusSpace} />
      <div className={styles.result}>
        <Sticker rotate={5} className={styles.sticker}>
          {tone === "pending" ? "Verstuurd!" : tone === "correct" ? "Juist!" : "Helaas"}
        </Sticker>
        <p className={styles.points}>
          {tone === "pending" ? `Tot ${result.maxPoints} punten` : `+${result.points ?? 0} punten`}
        </p>
        <p className={styles.praise}>{praise}</p>
      </div>

      <section className={common.card}>
        <div className={styles.row}>
          <span className={common.cardLabel}>Jullie antwoord</span>
          {tone === "pending" ? (
            <StatusChip status="wacht" />
          ) : tone === "correct" ? (
            <StatusChip status="opgelost" />
          ) : (
            <StatusChip status="verdacht" label="Fout" />
          )}
        </div>
        <div className={styles.answer}>
          {result.photoAt && (
            <div className={styles.tile}>
              <span className={styles.tileTag}>Live {clock(result.photoAt)}</span>
            </div>
          )}
          <div className={styles.details}>
            <span className={styles.value}>{value}</span>
            <span className={styles.meta}>Vergrendeld om {clock(result.lockedAt)}</span>
            <span className={styles.meta}>{spotName}</span>
          </div>
        </div>
      </section>

      <div className={common.spacer} />
      <Voortgang done={done} total={total} />
      <Button onClick={onNext}>{nextNumber ? `Naar spot ${nextNumber}` : "Naar het klassement"}</Button>
    </main>
  );
}
