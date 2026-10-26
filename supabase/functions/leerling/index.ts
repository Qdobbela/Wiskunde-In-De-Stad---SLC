// Everything a group's phone does goes through this Edge Function. Students
// have no accounts and no database access; this function identifies the group
// by its secret token and only returns what that group may see. Question text
// is only sent after the server has unlocked the spot.
//
// POST /leerling/<action>   headers: x-groep (team token), x-toestel (phone id)
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { evaluate, pickValues, renderBody, type Params } from "../_shared/formula.ts";
import { distanceM, normalizeCode, rotateRoute } from "../_shared/geo.ts";
import { gradeNumber, gradeText, pointsFor } from "../_shared/grading.ts";
import { LEVELS, type Niveau } from "../_shared/niveau.ts";
import { dwellStatus, plausibility, type PingSample } from "../_shared/unlock.ts";

const db: SupabaseClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-groep, x-toestel",
  "access-control-allow-methods": "POST, OPTIONS",
};

/** A late answer is still accepted this long after the timer (network delay). */
const ANSWER_GRACE_S = 20;
/** A photo must come with a ping from inside the zone this recently. */
const PHOTO_PING_MAX_AGE_S = 90;
/** Photos may be taken a little outside the unlock radius (GPS wobble). */
const PHOTO_EXTRA_RADIUS_M = 20;
/** The same kind of flag for a group at most this often. */
const FLAG_THROTTLE_S = 120;
/** Suspicious flags that keep spots locked until the teacher decides. */
const BLOCKING_FLAGS = ["gps_jump", "mock_suspected"];

class Refusal extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Alleen POST" }, 405);
  const action = new URL(req.url).pathname.split("/").filter(Boolean).pop();
  try {
    switch (action) {
      case "check-code":
        return json(await checkCode(await req.json()));
      case "join":
        return json(await join(await req.json(), deviceOf(req)));
      case "state":
        return json(await state(await groupOf(req)));
      case "choose-level":
        return json(await chooseLevel(await groupOf(req), await req.json()));
      case "ping":
        return json(await ping(await groupOf(req), await req.json()));
      case "answer":
        return json(await answer(await groupOf(req), await req.formData()));
      case "event":
        return json(await event(await groupOf(req), await req.json()));
      case "ranking":
        return json(await ranking(await groupOf(req)));
      default:
        return json({ error: "Onbekende actie" }, 404);
    }
  } catch (err) {
    if (err instanceof Refusal) return json({ error: err.message }, err.status);
    console.error(err);
    return json({ error: "Er ging iets mis. Probeer opnieuw." }, 500);
  }
});

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

function deviceOf(req: Request): string {
  const device = req.headers.get("x-toestel") ?? "";
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(device)) throw new Refusal("Onbekende gsm");
  return device;
}

type Group = {
  id: string;
  name: string;
  start_index: number;
  started_at: string | null;
  member_first_names: string[];
  session: { id: string; status: string; ends_at: string | null; tour_id: string };
};

async function groupOf(req: Request): Promise<Group> {
  const token = req.headers.get("x-groep") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(token)) throw new Refusal("Geen groep", 401);
  const device = deviceOf(req);
  const { data } = await db
    .from("team")
    .select("id, name, start_index, started_at, member_first_names, device_id, session:session_id(id, status, ends_at, tour_id)")
    .eq("device_token", token)
    .maybeSingle();
  if (!data) throw new Refusal("Geen groep", 401);

  // Rule 8: one phone per group.
  if (!data.device_id) {
    await db.from("team").update({ device_id: device }).eq("id", data.id);
  } else if (data.device_id !== device) {
    await flag(data.id, "second_device", { device: device.slice(0, 8) });
    throw new Refusal("Deze groep speelt al op een andere gsm. Vraag je leerkracht om deze gsm toe te laten.", 403);
  }
  return data as unknown as Group;
}

function timeUp(group: Group) {
  const s = group.session;
  return s.status !== "live" || (s.ends_at !== null && Date.now() > new Date(s.ends_at).getTime());
}

async function flag(teamId: string, type: string, detail: Record<string, unknown>) {
  const since = new Date(Date.now() - FLAG_THROTTLE_S * 1000).toISOString();
  const { count } = await db
    .from("flag")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId)
    .eq("type", type)
    .gte("ts", since);
  if ((count ?? 0) === 0) await db.from("flag").insert({ team_id: teamId, type, detail });
}

// ---------------------------------------------------------------------------
// Joining (L01 to L04)
// ---------------------------------------------------------------------------

async function liveSession(code: string) {
  const { data } = await db
    .from("session")
    .select("id, status, ends_at, tour:tour_id(title)")
    .eq("code", normalizeCode(code))
    .maybeSingle();
  if (!data) throw new Refusal("Deze code bestaat niet. Kijk nog eens naar het bord.");
  if (data.status === "closed" || (data.ends_at && Date.now() > new Date(data.ends_at).getTime())) {
    throw new Refusal("Deze tocht is al afgelopen.");
  }
  if (data.status !== "live") throw new Refusal("Deze tocht is nog niet gestart.");
  return data as unknown as { id: string; tour: { title: string } | null };
}

async function checkCode(body: { code?: string }) {
  const code = normalizeCode(String(body.code ?? ""));
  if (!/^[A-Z0-9]{4,8}$/.test(code)) throw new Refusal("Vul de code van je leerkracht in.");
  const session = await liveSession(code);
  return { code, tourTitle: session.tour?.title ?? "" };
}

async function join(body: Record<string, unknown>, device: string) {
  const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
  const members = (Array.isArray(body.members) ? body.members : []).map((m) => String(m).trim()).filter(Boolean);
  if (name.length < 2 || name.length > 40) throw new Refusal("Kies een groepsnaam van 2 tot 40 tekens.");
  if (members.length === 0) throw new Refusal("Voeg minstens één leerling toe.");
  if (members.length > 8) throw new Refusal("Een groep heeft hoogstens 8 leerlingen.");
  if (members.some((m) => m.length > 20 || /\s/.test(m))) throw new Refusal("Gebruik alleen voornamen (zonder spaties).");

  const session = await liveSession(String(body.code ?? ""));

  // A group whose phone the teacher released continues on this phone.
  const { data: existing } = await db
    .from("team")
    .select("id, device_token, device_id")
    .eq("session_id", session.id)
    .eq("name", name)
    .maybeSingle();
  if (existing) {
    if (existing.device_id === null) {
      await db.from("team").update({ device_id: device }).eq("id", existing.id);
      return { token: existing.device_token, rejoined: true };
    }
    throw new Refusal("Die groepsnaam is al gekozen. Kies een andere.");
  }

  const { count } = await db.from("team").select("id", { count: "exact", head: true }).eq("session_id", session.id);
  const { data: team, error } = await db
    .from("team")
    .insert({
      session_id: session.id,
      name,
      member_first_names: members,
      // The level is chosen per spot (choose-level), not here.
      level: null,
      start_index: count ?? 0,
      started_at: new Date().toISOString(),
      device_id: device,
    })
    .select("device_token")
    .single();
  if (error) {
    if (error.code === "23505") throw new Refusal("Die groepsnaam is al gekozen. Kies een andere.");
    throw error;
  }
  return { token: team.device_token, rejoined: false };
}

// ---------------------------------------------------------------------------
// Route, unlocks and the open question
// ---------------------------------------------------------------------------

type Spot = { id: string; position: number; name: string; lat: number; lng: number; radius_m: number; dwell_s: number };

async function routeOf(group: Group) {
  const [{ data: locations }, { data: unlocks }, { data: answers }] = await Promise.all([
    db.from("location").select("id, position, name, lat, lng, radius_m, dwell_s").eq("tour_id", group.session.tour_id).order("position"),
    db.from("unlock").select("location_id, unlocked_at, deadline_at").eq("team_id", group.id),
    db.from("answer").select("id, question:question_id(location_id)").eq("team_id", group.id),
  ]);
  const done = new Set((answers ?? []).map((a: any) => a.question?.location_id));
  const unlocked = new Map((unlocks ?? []).map((u) => [u.location_id, u]));
  const route = rotateRoute((locations ?? []) as Spot[], group.start_index).map((s, i) => ({
    ...s,
    number: i + 1,
    done: done.has(s.id),
    unlocked: unlocked.has(s.id),
  }));
  return { route, unlocked };
}

async function blocked(teamId: string) {
  const { count } = await db
    .from("flag")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId)
    .is("resolved_at", null)
    .in("type", BLOCKING_FLAGS);
  return (count ?? 0) > 0;
}

async function openQuestion(group: Group, route: Awaited<ReturnType<typeof routeOf>>["route"], unlocked: Map<string, any>) {
  const open = route.find((s) => s.unlocked && !s.done);
  if (!open) return null;
  const { data: a } = await db
    .from("assignment")
    .select("param_values, question:question_id(id, level, body, answer_type, unit, needs_photo, photo_prompt, base_points)")
    .eq("team_id", group.id)
    .eq("location_id", open.id)
    .maybeSingle();

  // Unlocked, but no level chosen yet: offer the levels this spot has.
  if (!a) {
    const { data: questions } = await db
      .from("question")
      .select("level, base_points, needs_photo, answer_type")
      .eq("location_id", open.id);
    const levels = LEVELS.filter((level) => (questions ?? []).some((q) => q.level === level)).map((level) => {
      const q = (questions ?? []).find((x) => x.level === level)!;
      return { level, maxPoints: pointsFor(q.base_points, level, 1), needsPhoto: q.needs_photo || q.answer_type === "photo" };
    });
    return { needsLevel: true as const, locationId: open.id, spotName: open.name, number: open.number, levels };
  }

  const q = (a as any).question;
  return {
    needsLevel: false as const,
    locationId: open.id,
    spotName: open.name,
    number: open.number,
    level: q.level as Niveau,
    // Rule 2: the text is filled in and sent only now, after the unlock.
    body: renderBody(q.body, (a as any).param_values ?? {}),
    answerType: q.answer_type,
    unit: q.unit,
    needsPhoto: q.needs_photo || q.answer_type === "photo",
    photoPrompt: q.photo_prompt,
    maxPoints: pointsFor(q.base_points, q.level, 1),
    deadline: unlocked.get(open.id)?.deadline_at ?? null,
  };
}

async function latestMessage(sessionId: string) {
  const { data } = await db
    .from("session_message")
    .select("id, body, created_at")
    .eq("session_id", sessionId)
    .gte("created_at", new Date(Date.now() - 30 * 60_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function state(group: Group) {
  const { route, unlocked } = await routeOf(group);
  const [question, message, isBlocked] = await Promise.all([
    openQuestion(group, route, unlocked),
    latestMessage(group.session.id),
    blocked(group.id),
  ]);
  return {
    team: { name: group.name },
    session: { endsAt: group.session.ends_at, timeUp: timeUp(group) },
    route: route.map((s) => ({
      id: s.id,
      number: s.number,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      radiusM: s.radius_m,
      dwellS: s.dwell_s,
      done: s.done,
    })),
    question,
    message,
    blocked: isBlocked,
  };
}

/** Rule 1: the server opens the spot. The question follows when the group picks a level. */
async function unlockSpot(group: Group, spot: Spot) {
  const { count } = await db.from("question").select("id", { count: "exact", head: true }).eq("location_id", spot.id);
  if (!count) return false;
  const { error } = await db.from("unlock").insert({ team_id: group.id, location_id: spot.id });
  if (error && error.code !== "23505") throw error;
  return true;
}

/**
 * The group picks Basis, Gevorderd or Expert for this spot. Final: once a
 * question is assigned, the level can't change (no peeking at another level).
 */
async function chooseLevel(group: Group, body: Record<string, unknown>) {
  if (timeUp(group)) throw new Refusal("De tijd is om.");
  const locationId = String(body.locationId ?? "");
  const level = String(body.level ?? "") as Niveau;
  if (!LEVELS.includes(level)) throw new Refusal("Kies een niveau.");

  const [{ data: unlock }, { data: existing }, { data: questions }] = await Promise.all([
    db.from("unlock").select("location_id").eq("team_id", group.id).eq("location_id", locationId).maybeSingle(),
    db.from("assignment").select("question_id").eq("team_id", group.id).eq("location_id", locationId).maybeSingle(),
    db.from("question").select("id, level, params, correct_value, answer_type, time_limit_s").eq("location_id", locationId).eq("level", level),
  ]);
  if (!unlock) throw new Refusal("Deze spot is nog niet ontgrendeld.");
  if (existing) throw new Refusal("Jullie kozen al een niveau voor deze spot.", 409);
  if (!questions?.length) throw new Refusal("Er is geen vraag op dit niveau. Kies een ander niveau.");

  // Rule 4: each group its own variant and numbers.
  const q = questions[Math.floor(Math.random() * questions.length)];
  const values = pickValues((q.params ?? {}) as Params);
  const expected = q.answer_type === "number" && q.correct_value ? evaluate(q.correct_value, values) : null;
  const { error } = await db.from("assignment").insert({
    team_id: group.id,
    location_id: locationId,
    question_id: q.id,
    param_values: values,
    expected_value: expected,
  });
  if (error) {
    if (error.code === "23505") throw new Refusal("Jullie kozen al een niveau voor deze spot.", 409);
    throw error;
  }
  // The question timer starts now, when the group sees the question.
  if (q.time_limit_s) {
    await db
      .from("unlock")
      .update({ deadline_at: new Date(Date.now() + q.time_limit_s * 1000).toISOString() })
      .eq("team_id", group.id)
      .eq("location_id", locationId);
  }
  return state(group);
}

async function ping(group: Group, body: Record<string, unknown>) {
  if (timeUp(group)) return { status: "time_up" };
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
  const lat = num(body.lat), lng = num(body.lng), accuracy = num(body.accuracy), ts = num(body.ts);
  const speed = body.speed === null || body.speed === undefined ? null : num(body.speed);
  if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && accuracy > 0 && Number.isFinite(ts))) {
    throw new Refusal("Ongeldige positie");
  }

  const { data: recent } = await db
    .from("ping")
    .select("lat, lng, accuracy_m, received_at")
    .eq("team_id", group.id)
    .gte("received_at", new Date(Date.now() - 3 * 60_000).toISOString())
    .order("received_at", { ascending: false })
    .limit(40);
  if (recent?.[0] && Date.now() - new Date(recent[0].received_at).getTime() < 2000) {
    return { status: "skipped" };
  }

  const phoneTime = Math.abs(ts - Date.now()) < 24 * 3600e3 ? new Date(ts) : new Date();
  const { data: inserted } = await db
    .from("ping")
    .insert({ team_id: group.id, lat, lng, accuracy_m: accuracy, speed: Number.isFinite(speed as number) ? speed : null, ts: phoneTime.toISOString() })
    .select("received_at")
    .single();

  const samples: PingSample[] = [
    { lat, lng, accuracy, at: new Date(inserted!.received_at).getTime() },
    ...(recent ?? []).map((p) => ({ lat: p.lat, lng: p.lng, accuracy: p.accuracy_m, at: new Date(p.received_at).getTime() })),
  ];

  // Rule 3: plausibility.
  const suspicion = plausibility(samples);
  if (suspicion) await flag(group.id, suspicion.type, suspicion.detail);

  const { route, unlocked } = await routeOf(group);
  if (route.some((s) => s.unlocked && !s.done)) return { status: "question_open" };
  const todo = route.filter((s) => !s.done && !s.unlocked);
  if (todo.length === 0) return { status: "finished" };

  // The nearest spot still to do (normally the next one on the route).
  const target = todo.reduce((best, s) => (distanceM({ lat, lng }, s) < distanceM({ lat, lng }, best) ? s : best), todo[0]);
  const dwell = dwellStatus(samples, { lat: target.lat, lng: target.lng, radiusM: target.radius_m, dwellS: target.dwell_s });
  const isBlocked = await blocked(group.id);

  // Rule 1: unlock on the server only.
  if (dwell.ready && !isBlocked && (await unlockSpot(group, target))) {
    return { status: "unlocked", locationId: target.id };
  }
  return {
    status: dwell.inside ? "in_zone" : "walking",
    target: target.id,
    distance: Math.round(dwell.distance),
    accurate: dwell.accurate,
    streakSeconds: Math.floor(dwell.streakSeconds),
    dwellS: target.dwell_s,
    blocked: isBlocked,
    unlockedCount: unlocked.size,
  };
}

// ---------------------------------------------------------------------------
// Answers (L07 to L09)
// ---------------------------------------------------------------------------

async function answer(group: Group, form: FormData) {
  if (timeUp(group)) throw new Refusal("De tijd is om. Antwoorden kan niet meer.");
  const locationId = String(form.get("locationId") ?? "");
  const value = String(form.get("value") ?? "").trim();
  const photo = form.get("photo");

  const [{ data: unlock }, { data: assignment }] = await Promise.all([
    db.from("unlock").select("unlocked_at, deadline_at").eq("team_id", group.id).eq("location_id", locationId).maybeSingle(),
    db
      .from("assignment")
      .select("expected_value, question:question_id(id, level, answer_type, correct_value, tolerance, needs_photo, base_points, unit)")
      .eq("team_id", group.id)
      .eq("location_id", locationId)
      .maybeSingle(),
  ]);
  if (!unlock || !assignment) throw new Refusal("Deze vraag is nog niet ontgrendeld.");
  if (unlock.deadline_at && Date.now() > new Date(unlock.deadline_at).getTime() + ANSWER_GRACE_S * 1000) {
    throw new Refusal("De tijd voor deze vraag is om.");
  }
  const q = (assignment as any).question;
  const needsPhoto = q.needs_photo || q.answer_type === "photo";

  // Grade first: an invalid number ("31.8") can be fixed and sent again.
  let autoCorrect: boolean | null = null;
  if (q.answer_type === "number") {
    const grade = gradeNumber(value, Number((assignment as any).expected_value), Number(q.tolerance));
    if (!grade.valid) throw new Refusal(grade.error);
    autoCorrect = grade.correct;
  } else if (q.answer_type === "text") {
    const grade = gradeText(value, q.correct_value ?? "");
    if (!grade.valid) throw new Refusal(grade.error);
    autoCorrect = grade.correct;
  }

  // Rule 6: live photos only, taken in the zone, stored with server time.
  let photoPath: string | null = null;
  let photoAt: string | null = null;
  let photoLat: number | null = null;
  let photoLng: number | null = null;
  if (needsPhoto) {
    if (!(photo instanceof File) || photo.size === 0) throw new Refusal("Neem eerst een foto met de camera.");
    if (photo.size > 8 * 1024 * 1024) throw new Refusal("De foto is te groot.");
    const [{ data: spot }, { data: last }] = await Promise.all([
      db.from("location").select("lat, lng, radius_m").eq("id", locationId).single(),
      db.from("ping").select("lat, lng, received_at").eq("team_id", group.id).order("received_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const fresh = last && Date.now() - new Date(last.received_at).getTime() < PHOTO_PING_MAX_AGE_S * 1000;
    if (!fresh || distanceM(last, spot!) > spot!.radius_m + PHOTO_EXTRA_RADIUS_M) {
      throw new Refusal("Neem de foto ter plaatse, in de zone van de spot.");
    }
    photoPath = `${group.session.id}/${group.id}/${q.id}.jpg`;
    const { error } = await db.storage.from("photos").upload(photoPath, photo, { contentType: "image/jpeg", upsert: false });
    if (error) throw new Refusal("De foto kon niet worden opgeslagen. Probeer opnieuw.");
    photoAt = new Date().toISOString();
    photoLat = last!.lat;
    photoLng = last!.lng;
  }

  // Rule 5: insert only; the database refuses a second answer and any change.
  const { data: saved, error } = await db
    .from("answer")
    .insert({
      team_id: group.id,
      question_id: q.id,
      value: value || null,
      photo_path: photoPath,
      photo_taken_at: photoAt,
      photo_lat: photoLat,
      photo_lng: photoLng,
      auto_correct: autoCorrect,
    })
    .select("submitted_at")
    .single();
  if (error) {
    if (error.code === "23505") throw new Refusal("Jullie antwoord was al verstuurd.");
    throw error;
  }

  const pending = needsPhoto;
  const expected = (assignment as any).expected_value;
  return {
    correct: pending ? null : autoCorrect,
    pending,
    level: q.level,
    points: pending ? null : pointsFor(q.base_points, q.level, autoCorrect ? 1 : 0),
    maxPoints: pointsFor(q.base_points, q.level, 1),
    value,
    unit: q.unit,
    lockedAt: saved.submitted_at,
    photoAt,
    // Show the right answer after a wrong one: the numbers differ per group.
    expected: autoCorrect === false ? (q.answer_type === "number" ? expected : q.correct_value?.split("|")[0]) : null,
  };
}

// Rule 7: leaving the app during an open question.
async function event(group: Group, body: Record<string, unknown>) {
  const seconds = Math.round(Number(body.seconds));
  if (body.type !== "app_left" || !(seconds >= 3 && seconds < 24 * 3600)) return { ok: true };
  // Was a question open when they left? The answer may already have arrived
  // (students often send it right after coming back), so compare with the time
  // they left rather than with now.
  const leftAt = new Date(Date.now() - seconds * 1000).toISOString();
  const [{ route }, { data: answers }] = await Promise.all([
    routeOf(group),
    db.from("answer").select("submitted_at, question:question_id(location_id)").eq("team_id", group.id),
  ]);
  const answeredAt = new Map((answers ?? []).map((a: any) => [a.question?.location_id, a.submitted_at as string]));
  const open = route.find((s) => s.unlocked && (!s.done || (answeredAt.get(s.id) ?? "") >= leftAt));
  if (!open) return { ok: true };
  await db.from("flag").insert({
    team_id: group.id,
    type: "app_left",
    detail: { seconds, location_id: open.id, spot: open.name, spot_number: open.number },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// L10 Klassement
// ---------------------------------------------------------------------------

async function ranking(group: Group) {
  const [{ data: teams }, { data: points }, { count: spotCount }] = await Promise.all([
    db.from("team").select("id, name, started_at").eq("session_id", group.session.id),
    db.from("answer_points").select("team_id, points, score"),
    db.from("location").select("id", { count: "exact", head: true }).eq("tour_id", group.session.tour_id),
  ]);
  const ids = new Set((teams ?? []).map((t) => t.id));
  const totals = new Map<string, { points: number; pending: number }>();
  for (const p of points ?? []) {
    if (!ids.has(p.team_id)) continue;
    const t = totals.get(p.team_id) ?? { points: 0, pending: 0 };
    t.points += Number(p.points ?? 0);
    if (p.score === null) t.pending++;
    totals.set(p.team_id, t);
  }
  const { data: answers } = await db.from("answer").select("team_id, submitted_at").in("team_id", [...ids]);
  const doneCount = new Map<string, number>();
  const lastAnswer = new Map<string, string>();
  for (const a of answers ?? []) {
    doneCount.set(a.team_id, (doneCount.get(a.team_id) ?? 0) + 1);
    if (!lastAnswer.has(a.team_id) || a.submitted_at > lastAnswer.get(a.team_id)!) lastAnswer.set(a.team_id, a.submitted_at);
  }
  const rows = (teams ?? [])
    .map((t) => ({ id: t.id, name: t.name, points: totals.get(t.id)?.points ?? 0 }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const me = rows.findIndex((r) => r.id === group.id);
  const started = group.started_at ? new Date(group.started_at).getTime() : null;
  const last = lastAnswer.get(group.id);
  return {
    place: me + 1,
    rows: rows.map((r, i) => ({ place: i + 1, name: r.name, points: r.points, isMe: r.id === group.id })),
    done: doneCount.get(group.id) ?? 0,
    total: spotCount ?? 0,
    seconds: started && last ? Math.round((new Date(last).getTime() - started) / 1000) : null,
    pendingReview: [...totals.values()].some((t) => t.pending > 0),
  };
}
