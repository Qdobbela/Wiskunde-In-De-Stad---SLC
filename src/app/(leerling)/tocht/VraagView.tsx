"use client";

import { useEffect, useMemo, useState } from "react";
import { SpotBadge } from "@/components/student/SpotBadge";
import { StatusBar } from "@/components/student/StatusBar";
import { Timer } from "@/components/student/Timer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { NiveauTag } from "@/components/ui/NiveauTag";
import type { Niveau } from "@/lib/niveau";
import { parseDutchNumber } from "@/lib/number";
import { ApiError, call, type AnswerResult, type OpenQuestion } from "@/lib/student/api";
import type { GeoFix, GeoStatus } from "@/lib/student/useGeolocation";
import { Camera } from "./Camera";
import common from "@/components/student/student.module.css";
import styles from "./vraag.module.css";

type VraagViewProps = {
  question: OpenQuestion;
  level: Niveau;
  current: number;
  total: number;
  sessionEndsAt: string | null;
  fix: GeoFix | null;
  geoStatus: GeoStatus;
  onAnswered: (result: AnswerResult) => void;
};

/** L07 Vraag (and L08 Camera when a photo is needed). */
export function VraagView({ question, level, current, total, sessionEndsAt, fix, geoStatus, onAnswered }: VraagViewProps) {
  const [value, setValue] = useState("");
  const [photo, setPhoto] = useState<{ blob: Blob; at: Date } | null>(null);
  const [camera, setCamera] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo.blob) : null), [photo]);
  useEffect(() => () => void (photoUrl && URL.revokeObjectURL(photoUrl)), [photoUrl]);

  const isNumber = question.answerType === "number";
  const needsValue = question.answerType !== "photo";
  const numberInvalid = isNumber && value.trim() !== "" && parseDutchNumber(value) === null;
  const canSend = (!needsValue || value.trim() !== "") && (!question.needsPhoto || photo) && !numberInvalid && !sending;

  async function send() {
    setError(null);
    setSending(true);
    const form = new FormData();
    form.append("locationId", question.locationId);
    form.append("value", value);
    if (photo) form.append("photo", photo.blob, "foto.jpg");
    try {
      onAnswered(await call<AnswerResult>("answer", form));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Versturen lukte niet. Probeer opnieuw.");
      setSending(false);
    }
  }

  if (camera) {
    return (
      <Camera
        prompt={question.photoPrompt || "Neem een foto ter plaatse."}
        geoStatus={geoStatus}
        fix={fix}
        onCancel={() => setCamera(false)}
        onCapture={(blob) => {
          setPhoto({ blob, at: new Date() });
          setCamera(false);
        }}
      />
    );
  }

  return (
    <main className={common.screen}>
      <StatusBar status={geoStatus} fix={fix} />
      <div className={styles.topBar}>
        <SpotBadge current={current} total={total} />
        {question.deadline ? <Timer endsAt={question.deadline} /> : sessionEndsAt && <Timer endsAt={sessionEndsAt} />}
      </div>
      <div>
        <p className={common.step}>Jullie staan aan</p>
        <h1 className={common.title}>{question.spotName}</h1>
      </div>

      <section className={`${common.card} ${styles.question}`}>
        <NiveauTag niveau={level} />
        <p className={styles.body}>{question.body}</p>
        {question.needsPhoto && question.photoPrompt && <p className={styles.photoPrompt}>Foto: {question.photoPrompt}</p>}
        {needsValue && (
          <Input
            label="Jullie antwoord"
            numeric={isNumber}
            unit={question.unit ?? undefined}
            value={value}
            placeholder={isNumber ? "0" : ""}
            onChange={(e) => setValue(e.target.value)}
            hint={isNumber ? "Gebruik een komma voor decimalen" : undefined}
            error={numberInvalid ? "Gebruik een komma voor decimalen" : undefined}
            autoComplete="off"
          />
        )}
      </section>

      {question.needsPhoto &&
        (photo && photoUrl ? (
          <div className={styles.photoRow}>
            <div className={styles.tile}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local photo preview */}
              <img src={photoUrl} alt="Jullie foto" />
              <span className={styles.tileTag}>
                Live {photo.at.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <Button variant="outline" onClick={() => setCamera(true)}>
              Opnieuw
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setCamera(true)}>
            + Foto met camera
          </Button>
        ))}

      {error && (
        <p className={common.error} role="alert">
          {error}
        </p>
      )}
      <div className={common.spacer} />
      <Button onClick={send} disabled={!canSend}>
        {sending ? "Versturen…" : "Versturen"}
      </Button>
      <p className={styles.note}>Na versturen ligt jullie antwoord vast.</p>
    </main>
  );
}
