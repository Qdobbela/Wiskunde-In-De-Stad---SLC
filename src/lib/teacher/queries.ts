"use client";

import { supabase } from "@/lib/supabase/client";
import { must } from "@/lib/useLoad";
import { LEVELS } from "@/lib/niveau";

export type TourSummary = {
  id: string;
  title: string;
  spots: { id: string; position: number; lat: number; lng: number; complete: boolean }[];
  questionCount: number;
  missingCount: number;
  ready: boolean;
  lastUsed: string | null;
};

export async function listTours(): Promise<TourSummary[]> {
  const data = must(
    await supabase()
      .from("tour")
      .select("id, title, created_at, location(id, position, lat, lng, question(level)), session(created_at)")
      .order("created_at", { ascending: false }),
  );
  return data.map((tour) => {
    const spots = [...tour.location]
      .sort((a, b) => a.position - b.position)
      .map((loc) => {
        const levels = new Set(loc.question.map((q) => q.level));
        return {
          id: loc.id,
          position: loc.position,
          lat: loc.lat,
          lng: loc.lng,
          complete: LEVELS.every((l) => levels.has(l)),
          filled: levels.size,
        };
      });
    const missingCount = spots.reduce((n, s) => n + (LEVELS.length - s.filled), 0);
    return {
      id: tour.id,
      title: tour.title,
      spots: spots.map(({ filled: _filled, ...s }) => s),
      questionCount: tour.location.reduce((n, l) => n + l.question.length, 0),
      missingCount,
      ready: spots.length > 0 && missingCount === 0,
      lastUsed: tour.session.map((s) => s.created_at).sort().at(-1) ?? null,
    };
  });
}

export type SessionSummary = {
  id: string;
  code: string;
  createdAt: string;
  classLabel: string;
  status: string;
  endsAt: string | null;
  tourTitle: string;
  teamCount: number;
  averagePoints: number | null;
};

/** Points per team from the answer_points view (RLS: own sessions only). */
export async function pointsByTeam(teamIds: string[]) {
  const totals = new Map<string, number>();
  if (teamIds.length === 0) return totals;
  const rows = must(await supabase().from("answer_points").select("team_id, points").in("team_id", teamIds));
  for (const row of rows) {
    if (row.team_id) totals.set(row.team_id, (totals.get(row.team_id) ?? 0) + Number(row.points ?? 0));
  }
  return totals;
}

export async function listSessions(limit = 20): Promise<SessionSummary[]> {
  const data = must(
    await supabase()
      .from("session")
      .select("id, code, created_at, class_label, status, ends_at, tour(title), team(id)")
      .order("created_at", { ascending: false })
      .limit(limit),
  );
  const totals = await pointsByTeam(data.flatMap((s) => s.team.map((t) => t.id)));
  return data.map((s) => {
    const points = s.team.map((t) => totals.get(t.id) ?? 0);
    return {
      id: s.id,
      code: s.code,
      createdAt: s.created_at,
      classLabel: s.class_label,
      status: s.status,
      endsAt: s.ends_at,
      tourTitle: s.tour?.title ?? "",
      teamCount: s.team.length,
      averagePoints: points.length ? Math.round(points.reduce((a, b) => a + b, 0) / points.length) : null,
    };
  });
}

/** A session that's still running: live and not past its end time. */
export function isRunning(s: { status: string; endsAt?: string | null; ends_at?: string | null }) {
  const end = s.endsAt ?? s.ends_at;
  return s.status === "live" && (!end || new Date(end).getTime() > Date.now());
}
