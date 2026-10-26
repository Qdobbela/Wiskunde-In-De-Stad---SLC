// API check of the "leerling" Edge Function against the real Supabase project:
// join, pings, server-side unlock, grading, answer lock, flags, one phone per
// group, ranking. Creates a throwaway teacher/tour/session and deletes it.
//
//   npm run e2e:api
import { admin, createTestTeacher, step } from "./helpers.mjs";

const FN = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/leerling`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failures++;
  console.log(ok ? "PASS" : "FAIL", name, extra);
};

async function call(action, body, { token, device = "toestel-aaaa-1111", form } = {}) {
  const headers = { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "x-toestel": device };
  if (token) headers["x-groep"] = token;
  if (!form) headers["content-type"] = "application/json";
  const res = await fetch(`${FN}/${action}`, { method: "POST", headers, body: form ?? JSON.stringify(body ?? {}) });
  return { status: res.status, ...(await res.json()) };
}

const BELFORT = { lat: 51.0536, lng: 3.7253 };
const north = (m) => ({ lat: BELFORT.lat + m / 111_320, lng: BELFORT.lng });

const teacher = await createTestTeacher();
try {
  const { data: tour } = await admin.from("tour").insert({ teacher_id: teacher.user.id, title: "API-test" }).select().single();
  const { data: spots } = await admin
    .from("location")
    .insert([
      { tour_id: tour.id, position: 1, name: "Belfort", ...BELFORT, radius_m: 25, dwell_s: 6 },
      { tour_id: tour.id, position: 2, name: "Gravensteen", lat: 51.0573, lng: 3.7208, radius_m: 25, dwell_s: 6 },
    ])
    .select()
    .order("position");
  // A batch insert fills missing fields with null (not the default), so every
  // row gets every field.
  const question = (fields) => ({
    params: {}, correct_value: null, needs_photo: false, photo_prompt: null, base_points: 10, ...fields,
  });
  const { error: questionError } = await admin.from("question").insert([
    question({ location_id: spots[0].id, level: "expert", body: "Hoeveel is {n} keer {z}?", answer_type: "number", correct_value: "n × z", params: { n: { min: 2, max: 5 }, z: { min: 8, max: 15 } }, base_points: 30 }),
    question({ location_id: spots[0].id, level: "basis", body: "Basisvraag", answer_type: "number", correct_value: "1" }),
    question({ location_id: spots[1].id, level: "expert", body: "Welke kleur heeft de vlag?", answer_type: "text", correct_value: "geel|zwart", needs_photo: true, photo_prompt: "Foto van de vlag", base_points: 20 }),
  ]);
  if (questionError) throw questionError;
  const { data: session } = await admin
    .from("session")
    .insert({ tour_id: tour.id, status: "live", ends_at: new Date(Date.now() + 3600e3).toISOString() })
    .select()
    .single();

  // Joining
  const bad = await call("check-code", { code: "ZZZZZZ" });
  check("unknown code refused", bad.status === 400, bad.error);
  const ok = await call("check-code", { code: session.code.toLowerCase() });
  check("code accepted (any case)", ok.code === session.code && ok.tourTitle === "API-test");
  const joined = await call("join", { code: session.code, name: "De Torenwachters", members: ["Amira", "Lucas"], level: "expert" });
  check("group created", typeof joined.token === "string");
  const token = joined.token;
  const dup = await call("join", { code: session.code, name: "De Torenwachters", members: ["Jonas"], level: "basis" }, { device: "toestel-bbbb-2222" });
  check("duplicate name refused", dup.status === 400, dup.error);

  // Rule 2: no question text before unlock.
  let s = await call("state", {}, { token });
  check("state: route without question", s.route.length === 2 && s.question === null && !JSON.stringify(s).includes("keer"));

  // Rule 1: walking, then standing in the zone with bad accuracy, then good.
  // 40 m away: a realistic approach (a 300 m jump in 3 s would be flagged).
  let p = await call("ping", { ...north(40), accuracy: 10, ts: Date.now() }, { token });
  check("outside the zone → walking", p.status === "walking" && p.distance === 40, `${p.status} ${p.distance} m`);
  for (let i = 0; i < 4; i++) {
    await sleep(2600);
    p = await call("ping", { ...north(5 + i * 0.3), accuracy: 60, ts: Date.now() }, { token });
  }
  check("in zone but inaccurate → no unlock", p.status === "in_zone" && p.accurate === false && p.streakSeconds === 0, JSON.stringify(p));
  for (let i = 0; i < 4 && p.status !== "unlocked"; i++) {
    await sleep(2600);
    p = await call("ping", { ...north(4 + i * 0.4), accuracy: 9 + i, ts: Date.now() }, { token });
  }
  check("6 s dwell over ≥ 3 accurate pings → unlocked", p.status === "unlocked", JSON.stringify(p));

  // Level per spot: unlocked, but no question text until a level is chosen.
  s = await call("state", {}, { token });
  check(
    "unlocked spot asks for a level, without question text",
    s.question?.needsLevel === true && s.question.levels.map((l) => l.level).join() === "basis,expert" && !JSON.stringify(s).includes("Hoeveel"),
    JSON.stringify(s.question),
  );
  const none = await call("choose-level", { locationId: spots[0].id, level: "gevorderd" }, { token });
  check("a level without a question is refused", none.status === 400, none.error);
  s = await call("choose-level", { locationId: spots[0].id, level: "expert" }, { token });
  const again2 = await call("choose-level", { locationId: spots[0].id, level: "basis" }, { token });
  check("the level can't be changed afterwards", again2.status === 409, again2.error);
  const { data: assignment } = await admin.from("assignment").select("param_values, expected_value").eq("location_id", spots[0].id).single();
  const { n, z } = assignment.param_values;
  check("question text filled in with this group's numbers", s.question?.body === `Hoeveel is ${n} keer ${z}?`, s.question?.body);
  check("expert level question chosen, max 60 points", s.question.maxPoints === 60);

  // Grading and answer lock
  const form = (fields) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.append(k, v);
    return f;
  };
  const dot = await call("answer", null, { token, form: form({ locationId: spots[0].id, value: "12.5" }) });
  check("'12.5' refused (decimal comma), can retry", dot.status === 400 && /komma/.test(dot.error), dot.error);
  const right = await call("answer", null, { token, form: form({ locationId: spots[0].id, value: String(n * z) }) });
  check("correct answer → +60", right.correct === true && right.points === 60, JSON.stringify(right));
  const again = await call("answer", null, { token, form: form({ locationId: spots[0].id, value: "1" }) });
  check("second answer refused (locked)", again.status === 400, again.error);

  // Spot 2: photo required.
  p = {};
  for (let i = 0; i < 4 && p.status !== "unlocked"; i++) {
    await sleep(2600);
    p = await call("ping", { lat: 51.0573 + i * 2e-6, lng: 3.7208, accuracy: 8, ts: Date.now() }, { token });
  }
  // The walk from Belfort to Gravensteen took seconds: a GPS jump, so spot 2 stays locked.
  const { data: jumps } = await admin.from("flag").select("id, type").eq("team_id", (await admin.from("team").select("id").eq("device_token", token).single()).data.id);
  check("teleporting 500 m flags gps_jump", jumps.some((f) => f.type === "gps_jump"));
  check("unresolved gps_jump keeps the spot locked", p.status !== "unlocked" && p.blocked === true, JSON.stringify(p));
  await admin.from("flag").update({ resolved_at: new Date().toISOString() }).in("id", jumps.map((f) => f.id));
  p = {};
  for (let i = 0; i < 4 && p.status !== "unlocked"; i++) {
    await sleep(2600);
    p = await call("ping", { lat: 51.0573 + i * 3e-6, lng: 3.7208, accuracy: 8, ts: Date.now() }, { token });
  }
  check("after the teacher resolves it → unlocked", p.status === "unlocked", JSON.stringify(p));
  s = await call("choose-level", { locationId: spots[1].id, level: "expert" }, { token });
  check("photo question", s.question?.needsPhoto === true && s.question.photoPrompt === "Foto van de vlag");
  const noPhoto = await call("answer", null, { token, form: form({ locationId: spots[1].id, value: "geel" }) });
  check("answer without photo refused", noPhoto.status === 400, noPhoto.error);
  const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 0xff, 0xd9])], { type: "image/jpeg" });
  const withPhoto = form({ locationId: spots[1].id, value: "Geel" });
  withPhoto.append("photo", jpeg, "foto.jpg");
  const photoAnswer = await call("answer", null, { token, form: withPhoto });
  check("photo answer stored, waits for teacher", photoAnswer.pending === true && photoAnswer.photoAt, JSON.stringify(photoAnswer));

  // Rule 7 and 8
  const left = await call("event", { type: "app_left", seconds: 40 }, { token });
  check("app_left without open question ignored", left.ok === true);
  const other = await call("state", {}, { token, device: "toestel-cccc-3333" });
  check("same group on another phone refused", other.status === 403, other.error);
  const { data: flags } = await admin.from("flag").select("type").eq("team_id", (await admin.from("team").select("id").eq("device_token", token).single()).data.id);
  check("second_device flagged", flags.some((f) => f.type === "second_device"));

  // Teacher lets a new phone in: rejoin with the same name.
  await admin.from("team").update({ device_id: null }).eq("device_token", token);
  const rejoin = await call("join", { code: session.code, name: "De Torenwachters", members: ["Amira"], level: "expert" }, { device: "toestel-dddd-4444" });
  check("rejoin on a new phone after the teacher allows it", rejoin.token === token && rejoin.rejoined === true);

  const rank = await call("ranking", {}, { token, device: "toestel-dddd-4444" });
  check("ranking: place 1 with 60 points, photo pending", rank.place === 1 && rank.rows[0].points === 60 && rank.pendingReview === true, JSON.stringify(rank));

  // Time's up: no more answers.
  await admin.from("session").update({ ends_at: new Date(Date.now() - 1000).toISOString() }).eq("id", session.id);
  s = await call("state", {}, { token, device: "toestel-dddd-4444" });
  check("time up shows in state", s.session.timeUp === true);
} catch (e) {
  failures++;
  console.log("FAILED:", e);
} finally {
  await admin.storage.from("photos").list().then(() => {});
  await admin.auth.admin.deleteUser(teacher.user.id);
  step(failures ? `${failures} check(s) failed` : "all checks passed");
  process.exitCode = failures ? 1 : 0;
}
