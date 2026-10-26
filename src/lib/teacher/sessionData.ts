"use client";

import { supabase } from "@/lib/supabase/client";
import { must } from "@/lib/useLoad";
import type { Niveau } from "@/lib/niveau";
import { rotateRoute } from "@/lib/geo";

export type FlagRow = {
  id: string;
  team_id: string;
  type: "gps_jump" | "mock_suspected" | "low_accuracy" | "app_left" | "second_device";
  detail: Record<string, number | string>;
  ts: string;
  resolved_at: string | null;
};

export type AnswerRow = {
  id: string;
  team_id: string;
  value: string | null;
  photo_path: string | null;
  photo_taken_at: string | null;
  photo_lat: number | null;
  photo_lng: number | null;
  submitted_at: string;
  auto_correct: boolean | null;
  teacher_score: number | null;
  question: {
    id: string;
    location_id: string;
    body: string;
    answer_type: "number" | "text" | "photo";
    unit: string | null;
    needs_photo: boolean;
    photo_prompt: string | null;
    base_points: number;
  };
};

export type Spot = { id: string; position: number; name: string; lat: number; lng: number; radius_m: number; dwell_s: number };

export type TeamOverview = {
  id: string;
  /** "G1", "G2"… in join order. */
  label: string;
  name: string;
  level: Niveau;
  members: string[];
  startedAt: string | null;
  deviceBound: boolean;
  route: Spot[];
  lastPing: { lat: number; lng: number; accuracy_m: number; received_at: string } | null;
  unlocks: { location_id: string; unlocked_at: string }[];
  answers: AnswerRow[];
  flags: FlagRow[];
  done: number;
  openSpot: Spot | null;
  pendingPhotos: number;
  unresolvedFlags: FlagRow[];
  points: number;
  lastAnswerAt: string | null;
};

/** Score of an answer, as in the answer_points view: teacher > photo pending > auto. */
export function answerScore(a: AnswerRow): number | null {
  if (a.teacher_score !== null) return Number(a.teacher_score);
  if (a.question.needs_photo || a.question.answer_type === "photo") return null;
  return a.auto_correct ? 1 : 0;
}

export async function loadSession(sessionId: string) {
  const db = supabase();
  const session = must(
    await db
      .from("session")
      .select("id, code, status, class_label, ends_at, starts_at, created_at, tour:tour_id(id, title, location(id, position, name, lat, lng, radius_m, dwell_s))")
      .eq("id", sessionId)
      .single(),
  );
  const teams = must(
    await db
      .from("team")
      .select("id, name, level, member_first_names, start_index, started_at, device_id, created_at")
      .eq("session_id", sessionId)
      .order("start_index"),
  );
  const ids = teams.map((t) => t.id);
  const [pings, unlocks, answers, flags, points] = ids.length
    ? await Promise.all([
        db.from("team_last_ping").select("team_id, lat, lng, accuracy_m, received_at").in("team_id", ids).then(must),
        db.from("unlock").select("team_id, location_id, unlocked_at").in("team_id", ids).then(must),
        db
          .from("answer")
          .select("id, team_id, value, photo_path, photo_taken_at, photo_lat, photo_lng, submitted_at, auto_correct, teacher_score, question:question_id(id, location_id, body, answer_type, unit, needs_photo, photo_prompt, base_points)")
          .in("team_id", ids)
          .then(must),
        db.from("flag").select("id, team_id, type, detail, ts, resolved_at").in("team_id", ids).order("ts", { ascending: false }).then(must),
        db.from("answer_points").select("team_id, points").in("team_id", ids).then(must),
      ])
    : [[], [], [], [], []];

  const spots = [...(session.tour?.location ?? [])].sort((a, b) => a.position - b.position) as Spot[];
  const byTeam = <T extends { team_id: string | null }>(rows: T[], id: string) => rows.filter((r) => r.team_id === id);

  const overview: TeamOverview[] = teams.map((t, i) => {
    const teamAnswers = byTeam(answers as unknown as AnswerRow[], t.id);
    const teamUnlocks = byTeam(unlocks, t.id);
    const teamFlags = byTeam(flags as unknown as FlagRow[], t.id);
    const answered = new Set(teamAnswers.map((a) => a.question.location_id));
    const route = rotateRoute(spots, t.start_index);
    const open = teamUnlocks.find((u) => !answered.has(u.location_id));
    const last = (pings as { team_id: string; lat: number; lng: number; accuracy_m: number; received_at: string }[]).find((p) => p.team_id === t.id);
    return {
      id: t.id,
      label: `G${i + 1}`,
      name: t.name,
      level: t.level,
      members: t.member_first_names,
      startedAt: t.started_at,
      deviceBound: t.device_id !== null,
      route,
      lastPing: last ?? null,
      unlocks: teamUnlocks,
      answers: teamAnswers,
      flags: teamFlags,
      done: answered.size,
      openSpot: open ? spots.find((s) => s.id === open.location_id) ?? null : null,
      pendingPhotos: teamAnswers.filter((a) => a.photo_path && a.teacher_score === null).length,
      unresolvedFlags: teamFlags.filter((f) => !f.resolved_at),
      points: byTeam(points, t.id).reduce((n, p) => n + Number(p.points ?? 0), 0),
      lastAnswerAt: teamAnswers.map((a) => a.submitted_at).sort().at(-1) ?? null,
    };
  });

  return { session, spots, teams: overview };
}

export type SessionData = Awaited<ReturnType<typeof loadSession>>;

/** One-line Dutch description of a flag, for T04 and the T05 log. */
export function describeFlag(f: FlagRow): string {
  const d = f.detail ?? {};
  switch (f.type) {
    case "gps_jump":
      return `GPS-sprong van ${d.distance_m} m in ${String(d.seconds).replace(".", ",")} seconden. Mogelijk een nep-locatie app.`;
    case "mock_suspected":
      return `${d.identical_pings} keer exact dezelfde locatie. Mogelijk een nep-locatie app.`;
    case "second_device":
      return "Een tweede gsm probeerde mee te spelen met deze groep.";
    case "app_left":
      return `App ${d.seconds} sec verlaten tijdens vraag ${d.spot_number ?? ""}${d.spot ? ` (${d.spot})` : ""}.`;
    default:
      return "Lage GPS-nauwkeurigheid.";
  }
}

/** Flags that keep spots locked until the teacher decides (as in the Edge Function). */
export const BLOCKING_FLAGS: FlagRow["type"][] = ["gps_jump", "mock_suspected"];
