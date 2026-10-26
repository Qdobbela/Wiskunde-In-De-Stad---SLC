import "server-only";
import { redirect } from "next/navigation";
import { createTeacherClient } from "@/lib/supabase/server";
import { LEVELS } from "@/lib/niveau";

export { LEVELS };

export async function getTeacher() {
  const supabase = await createTeacherClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/leerkracht/login");
  const { data } = await supabase.from("teacher").select("*").eq("id", user.id).maybeSingle();
  // Logged in, but not a teacher (only Microsoft logins get a teacher row).
  if (!data) redirect("/auth/uitloggen?fout=geen-leerkracht");
  return data;
}

/** "Quinten Dobbelaere" → "Q. Dobbelaere" */
export function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

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
  const supabase = await createTeacherClient();
  const { data, error } = await supabase
    .from("tour")
    .select("id, title, created_at, location(id, position, lat, lng, question(level)), session(created_at)")
    .order("created_at", { ascending: false });
  if (error) throw error;

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
    const questionCount = tour.location.reduce((n, l) => n + l.question.length, 0);
    const missingCount = spots.reduce((n, s) => n + (LEVELS.length - s.filled), 0);
    const lastUsed =
      tour.session.map((s) => s.created_at).sort().at(-1) ?? null;
    return {
      id: tour.id,
      title: tour.title,
      spots: spots.map(({ filled: _filled, ...s }) => s),
      questionCount,
      missingCount,
      ready: spots.length > 0 && missingCount === 0,
      lastUsed,
    };
  });
}

export type SessionSummary = {
  id: string;
  createdAt: string;
  classLabel: string;
  status: string;
  tourTitle: string;
  teamCount: number;
  averagePoints: number | null;
};

export async function recentSessions(limit = 5): Promise<SessionSummary[]> {
  const supabase = await createTeacherClient();
  const { data, error } = await supabase
    .from("session")
    .select("id, created_at, class_label, status, tour(title), team(id)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const teamIds = data.flatMap((s) => s.team.map((t) => t.id));
  const pointsByTeam = new Map<string, number>();
  if (teamIds.length > 0) {
    const { data: points } = await supabase
      .from("answer_points")
      .select("team_id, points")
      .in("team_id", teamIds);
    for (const row of points ?? []) {
      if (!row.team_id) continue;
      pointsByTeam.set(row.team_id, (pointsByTeam.get(row.team_id) ?? 0) + Number(row.points ?? 0));
    }
  }

  return data.map((s) => {
    const totals = s.team.map((t) => pointsByTeam.get(t.id) ?? 0);
    return {
      id: s.id,
      createdAt: s.created_at,
      classLabel: s.class_label,
      status: s.status,
      tourTitle: s.tour?.title ?? "",
      teamCount: s.team.length,
      averagePoints: totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : null,
    };
  });
}

/** "3 okt" */
export function shortDate(iso: string) {
  return new Date(iso)
    .toLocaleDateString("nl-BE", { day: "numeric", month: "short" })
    .replace(".", "");
}

/** "3 oktober" */
export function longDate(iso: string) {
  return new Date(iso).toLocaleDateString("nl-BE", { day: "numeric", month: "long" });
}
