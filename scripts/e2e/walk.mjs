// The whole walk in the browser: two phones (fake GPS + fake camera) and the
// teacher's live map, against the real Supabase project and Edge Function.
// L01–L10 and T04–T06. Creates a throwaway teacher/tour/session; deletes it.
//
//   npm run build && npm run serve   (in another terminal)
//   npm run e2e:walk
import { admin, BASE, OUT, createTestTeacher, launch, loginTeacher, step, watchErrors } from "./helpers.mjs";

const BELFORT = { lat: 51.0536, lng: 3.7253 };
const north = (m, from = BELFORT) => ({ lat: from.lat + m / 111_320, lng: from.lng });
const SPOT2 = north(120);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failures++;
  console.log(ok ? "PASS" : "FAIL", name, extra);
};

const teacher = await createTestTeacher();
const { data: tour } = await admin.from("tour").insert({ teacher_id: teacher.user.id, title: "E2E Middeleeuws Gent" }).select().single();
const { data: spots } = await admin
  .from("location")
  .insert([
    { tour_id: tour.id, position: 1, name: "Belfort", ...BELFORT, radius_m: 25, dwell_s: 6 },
    { tour_id: tour.id, position: 2, name: "Lakenhalle", ...SPOT2, radius_m: 25, dwell_s: 6 },
  ])
  .select()
  .order("position");
const q = (fields) => ({ params: {}, tolerance: 0, correct_value: null, needs_photo: false, photo_prompt: null, base_points: 20, unit: null, ...fields });
const { error: qError } = await admin.from("question").insert([
  q({ location_id: spots[0].id, level: "expert", body: "Hoeveel is {n} keer {z}?", answer_type: "number", correct_value: "n × z", params: { n: { min: 2, max: 5 }, z: { min: 8, max: 15 } }, unit: "m", base_points: 30 }),
  q({ location_id: spots[0].id, level: "basis", body: "Hoeveel is 2 plus 2?", answer_type: "number", correct_value: "4" }),
  q({ location_id: spots[1].id, level: "expert", body: "Welke kleur heeft de vlag op de toren?", answer_type: "text", correct_value: "geel|zwart", needs_photo: true, photo_prompt: "de groep met de toren erachter" }),
  q({ location_id: spots[1].id, level: "basis", body: "Hoeveel ramen tel je?", answer_type: "number", correct_value: "12", tolerance: 2 }),
]);
if (qError) throw qError;
const { data: session } = await admin
  .from("session")
  .insert({ tour_id: tour.id, status: "live", class_label: "2B", ends_at: new Date(Date.now() + 3600e3).toISOString() })
  .select()
  .single();
step(`session ${session.code}`);

const browser = await launch();
const errors = [];
const phone = async (position) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    geolocation: { latitude: position.lat, longitude: position.lng, accuracy: 10 },
    permissions: ["geolocation", "camera"],
    locale: "nl-BE",
  });
  const page = await context.newPage();
  watchErrors(page, errors);
  return page;
};

/** Stand still for a while, with GPS wobble like a real phone. */
async function standAt(page, position, seconds) {
  for (let i = 0; i < seconds / 2; i++) {
    await page.context().setGeolocation({
      latitude: position.lat + (Math.random() - 0.5) * 0.00004,
      longitude: position.lng + (Math.random() - 0.5) * 0.00004,
      accuracy: 8 + Math.random() * 6,
    });
    await sleep(2000);
  }
}

/** Walk in steps of `step` m every 2 s (walking pace, no GPS jump). */
async function walk(page, from, to, stepM = 12) {
  const dist = (to.lat - from.lat) * 111_320;
  const steps = Math.max(1, Math.ceil(Math.abs(dist) / stepM));
  for (let i = 1; i <= steps; i++) {
    const p = north((dist * i) / steps, from);
    await page.context().setGeolocation({ latitude: p.lat, longitude: p.lng, accuracy: 9 });
    await sleep(2000);
  }
}

async function join(page, name, members, level) {
  await page.goto(BASE + "/");
  await page.getByLabel("Sessiecode van je leerkracht").fill(session.code.toLowerCase());
  await page.getByRole("button", { name: "Doe mee" }).click();
  await page.getByLabel("Groepsnaam").fill(name);
  for (const [i, m] of members.entries()) {
    if (i > 0) await page.getByRole("button", { name: "+ Leerling toevoegen" }).click();
    await page.getByLabel(`Voornaam leerling ${i + 1}`).fill(m);
  }
  await page.getByRole("button", { name: "Verder" }).click();
  await page.getByRole("radio", { name: new RegExp(level, "i") }).click();
  await page.getByRole("button", { name: new RegExp(`^Kies ${level}`, "i") }).click();
  await page.getByRole("button", { name: "Toestaan en starten" }).click();
  await page.waitForURL(/\/tocht\/$/);
}

try {
  // Teacher: live map.
  const tctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await loginTeacher(tctx, teacher);
  const t = await tctx.newPage();
  watchErrors(t, errors);
  await t.goto(`${BASE}/leerkracht/live/?sessie=${session.id}`);
  await t.getByRole("heading", { name: "E2E Middeleeuws Gent" }).waitFor();

  // Phone A starts 40 m from the Belfort, walks in and stands still.
  const a = await phone(north(-40));
  await join(a, "De Torenwachters", ["Amira", "Lucas"], "Expert");
  await a.getByText("Op weg naar").waitFor({ timeout: 15000 });
  check("L06 shown near a spot", true, (await a.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 160));
  await a.screenshot({ path: `${OUT}/L06.png` });
  await walk(a, north(-40), north(-4));
  await a.screenshot({ path: `${OUT}/L06-zone.png` });
  let unlocked = false;
  for (let i = 0; i < 10 && !unlocked; i++) {
    await standAt(a, north(-4), 4);
    unlocked = (await a.getByText("Jullie staan aan").count()) > 0;
  }
  check("question unlocked after standing in the zone", unlocked);
  const body = await a.locator("main p", { hasText: "Hoeveel is" }).innerText();
  const [, n, z] = body.match(/(\d+) keer (\d+)/) ?? [];
  check("question has this group's numbers", Boolean(n && z), body);
  await a.screenshot({ path: `${OUT}/L07.png` });

  // Leaving the app during the question is reported.
  await a.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await sleep(4000);
  await a.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });

  await a.getByLabel("Jullie antwoord").fill("12.5");
  check("decimal point → hint, can't send", await a.getByRole("button", { name: "Versturen" }).isDisabled());
  await a.getByLabel("Jullie antwoord").fill(String(Number(n) * Number(z)));
  await a.getByRole("button", { name: "Versturen" }).click();
  await a.getByText("Juist!").waitFor();
  check("L09 Juist! +60", (await a.locator("main").innerText()).includes("+60 PUNTEN"));
  await sleep(1000);
  {
    const { data: teamA } = await admin.from("team").select("id").eq("session_id", session.id).eq("name", "De Torenwachters").single();
    const { data: flagsA } = await admin.from("flag").select("type, detail").eq("team_id", teamA.id);
    check("leaving the app for 4 s is logged", flagsA.some((f) => f.type === "app_left"), JSON.stringify(flagsA));
  }

  await a.screenshot({ path: `${OUT}/L09.png` });
  await a.getByRole("button", { name: "Naar spot 2" }).click();

  // Walk on to spot 2 and take a photo there.
  await walk(a, north(-4), north(-2, SPOT2));
  unlocked = false;
  for (let i = 0; i < 10 && !unlocked; i++) {
    await standAt(a, north(-2, SPOT2), 4);
    unlocked = (await a.getByText("Welke kleur").count()) > 0;
  }
  check("spot 2 unlocked", unlocked);
  await a.getByRole("button", { name: "+ Foto met camera" }).click();
  await a.getByRole("button", { name: "Foto nemen" }).waitFor();
  await sleep(1500);
  await a.screenshot({ path: `${OUT}/L08.png` });
  await a.getByRole("button", { name: "Foto nemen" }).click();
  await a.getByAltText("Jullie foto").waitFor();
  await a.getByLabel("Jullie antwoord").fill("Geel");
  await a.getByRole("button", { name: "Versturen" }).click();
  await a.getByText("Verstuurd!").waitFor();
  check("photo answer waits for the teacher", (await a.locator("main").innerText()).includes("WACHT OP LEERKRACHT"));
  await a.screenshot({ path: `${OUT}/L09-foto.png` });

  // Phone B: on the map, then a GPS jump.
  const b = await phone(north(-300));
  await join(b, "Leiezwemmers", ["Jonas"], "Basis");
  await b.getByText("Volgende spot").waitFor({ timeout: 15000 });
  await sleep(3000);
  await b.screenshot({ path: `${OUT}/L05.png` });
  await b.context().setGeolocation({ latitude: north(300).lat, longitude: north(300).lng, accuracy: 8 });
  await sleep(6000);
  {
    const { data: teamB } = await admin.from("team").select("id").eq("session_id", session.id).eq("name", "Leiezwemmers").single();
    const { data: flagsB } = await admin.from("flag").select("type, detail, ts").eq("team_id", teamB.id);
    const { data: pingsB } = await admin.from("ping").select("lat, received_at").eq("team_id", teamB.id).order("received_at");
    step(`phone B: ${pingsB.length} pings (${pingsB.map((p) => Math.round((p.lat - BELFORT.lat) * 111320)).join(", ")} m), flags ${JSON.stringify(flagsB.map((f) => f.type))}`);
  }
  await t.getByText("Verdacht: Leiezwemmers").waitFor({ timeout: 25000 });
  check("teacher sees the GPS jump live", true, (await t.locator("section[role=alert]").innerText()).replace(/\n+/g, " | "));
  await t.screenshot({ path: `${OUT}/T04.png` });
  await t.getByRole("button", { name: "Negeer" }).click();

  // Message to everyone.
  await t.getByRole("button", { name: "Bericht aan iedereen" }).click();
  await t.getByLabel("Bericht aan alle groepen").fill("Kom om 11:30 terug naar het Belfort.");
  await t.getByRole("button", { name: "Versturen" }).click();
  await b.getByText("Bericht van je leerkracht").waitFor({ timeout: 25000 });
  check("walking phone shows the teacher's message", (await b.locator("[role=alert]").first().innerText()).includes("11:30"));
  await b.screenshot({ path: `${OUT}/L05-bericht.png` });

  // T05: review the photo.
  const { data: teamA } = await admin.from("team").select("id").eq("session_id", session.id).eq("name", "De Torenwachters").single();
  await t.goto(`${BASE}/leerkracht/groep/?id=${teamA.id}`);
  await t.getByText("Foto nakijken").first().waitFor();
  await t.locator("img[alt='Foto van de groep']").waitFor({ timeout: 10000 });
  await t.screenshot({ path: `${OUT}/T05.png` });
  check("log shows leaving the app", (await t.getByText(/App \d+ sec verlaten/).count()) > 0);
  await t.getByRole("button", { name: /^Juist 40/ }).click();
  await sleep(1500);

  // Close the session: results and ranking.
  await t.goto(`${BASE}/leerkracht/live/?sessie=${session.id}`);
  t.once("dialog", (d) => d.accept());
  await t.getByRole("button", { name: "Afsluiten" }).click();
  await t.waitForURL(/resultaten\/\?sessie=/);
  await t.getByText("Resultaten 2B").waitFor();
  await t.locator("a", { hasText: "De Torenwachters" }).waitFor();
  const results = (await t.locator("a", { hasText: "De Torenwachters" }).innerText()).replace(/\s*\n+\s*/g, " | ");
  check("T06: De Torenwachters first, 2/2 spots, 1 alert, 100 points", /^1 \| DE TORENWACHTERS \| NIVEAU: EXPERT \| 2\/2 \| [\d:]+ \| 1 \| 100$/i.test(results), results);
  await t.screenshot({ path: `${OUT}/T06.png` });

  await a.goto(`${BASE}/klassement/`);
  await a.getByText("Jullie eindigen op plek 1").waitFor();
  check("L10 klassement", true, (await a.locator("main").innerText()).replace(/\n+/g, " | "));
  await a.screenshot({ path: `${OUT}/L10.png` });
} catch (e) {
  failures++;
  console.log("FAILED:", e.message);
} finally {
  console.log("browser errors:", errors.length ? errors : "none");
  await browser.close();
  await admin.auth.admin.deleteUser(teacher.user.id);
  step(failures ? `${failures} check(s) failed` : "all checks passed");
  process.exitCode = failures ? 1 : 0;
}
