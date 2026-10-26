// End-to-end check of the teacher flow (T01 to T03 and starting a session)
// in your installed Chrome, against the real Supabase project.
// Creates a throwaway teacher and deletes it (and everything it made) after.
//
//   npm run build && npx next start -p 3123   (in another terminal)
//   npm run e2e:teacher
//
// Screenshots go to $E2E_OUT (default: .e2e/).
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const S = process.env.E2E_OUT ?? ".e2e";
mkdirSync(S, { recursive: true });
const BASE = process.env.E2E_BASE ?? "http://localhost:3123";
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(URL_, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

// Teachers log in with Microsoft, which a test can't do. Instead: an e-mail
// test user (needs the Email provider left on in Supabase), logged in here in
// Node, with the session cookies handed to Chrome. Only Microsoft logins get a
// teacher row automatically, so the test inserts one with the secret key.
const email = `e2e-${Date.now()}@example.com`, password = crypto.randomUUID();
const { data: { user } } = await admin.auth.admin.createUser({ email, password, email_confirm: true });

async function sessionCookies() {
  const jar = new Map();
  const client = createServerClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (all) => all.forEach((c) => jar.set(c.name, c.value)) },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return [...jar].map(([name, value]) => ({ name, value, url: BASE }));
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const step = (s) => console.log("•", s);
try {
  await page.goto(`${BASE}/leerkracht`);
  step("logged out → " + new URL(page.url()).pathname + ", buttons: " + (await page.getByRole("button").allInnerTexts()).join(", "));
  await page.screenshot({ path: `${S}/01-login.png` });

  // Logged in but no teacher row: sent back to the login page.
  await context.addCookies(await sessionCookies());
  await page.goto(`${BASE}/leerkracht`);
  step("no teacher row → " + new URL(page.url()).pathname + new URL(page.url()).search + ": " + (await page.locator("p[role=alert]").innerText()));

  await admin.from("teacher").insert({ id: user.id, email, name: "Quinten Dobbelaere", school: "Sint-Lievenscollege" });
  await context.addCookies(await sessionCookies());
  await page.goto(`${BASE}/leerkracht`);
  await page.waitForURL(`${BASE}/leerkracht`);
  step("logged in, sidebar: " + (await page.locator("nav").innerText()).replace(/\n/g, " | "));
  await page.getByRole("button", { name: "+ Nieuwe tocht" }).click();
  await page.waitForURL(/tochten\/[0-9a-f-]+$/);
  step("tour created");
  await page.locator(".maplibregl-canvas").waitFor();
  await page.waitForTimeout(2500);
  await page.getByLabel("Tocht bewerken").fill("Middeleeuws Gent");
  const box = await page.locator(".maplibregl-canvas").boundingBox();
  for (const [fx, fy] of [[0.3, 0.3], [0.55, 0.5], [0.75, 0.7]]) {
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    await page.waitForTimeout(300);
  }
  step("spots in list: " + await page.locator("ol li").count());
  await page.getByLabel("Naam van de spot").fill("Gravensteen");
  await page.screenshot({ path: `${S}/02-tour.png` });
  await page.getByRole("button", { name: "Opslaan" }).click();
  await page.getByRole("button", { name: "Opgeslagen" }).waitFor();
  step("tour saved");
  await page.getByRole("button", { name: "Vragen" }).click();
  await page.waitForURL(/spots\//);
  step("on questions page: " + await page.locator("h1").innerText());
  for (const level of ["Basis", "Gevorderd", "Expert"]) {
    await page.getByRole("radio", { name: new RegExp(`^${level}`) }).click();
    await page.getByLabel("Vraag", { exact: true }).fill("Een ridder loopt {n} keer rond een vierkante toren met zijden van {z} m. Hoeveel meter stapt hij in totaal?");
    await page.getByPlaceholder("= n × 4 × z").fill("= n × 4 × z");
    await page.getByLabel("n van", { exact: true }).fill("2"); await page.getByLabel("n tot", { exact: true }).fill("5");
    await page.getByLabel("z van", { exact: true }).fill("8"); await page.getByLabel("z tot", { exact: true }).fill("15");
  }
  await page.getByLabel("Eenheid", { exact: true }).fill("m");
  await page.getByRole("switch", { name: "Foto verplicht" }).click();
  await page.getByPlaceholder("de groep op de foto, met de toren erachter").fill("de groep op de foto, met de toren erachter");
  step("preview: " + (await page.locator("aside").innerText()).replace(/\n/g, " | "));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${S}/03-questions.png` });
  await page.getByRole("button", { name: "Opslaan" }).click();
  await page.getByRole("button", { name: "Opgeslagen" }).waitFor({ timeout: 10000 });
  step("questions saved");
  // Formula error shows up
  await page.getByPlaceholder("= n × 4 × z").fill("= n × (4");
  step("formula error: " + await page.locator("p", { hasText: "Haakje" }).first().innerText());
  await page.getByPlaceholder("= n × 4 × z").fill("= n × 4 × z");
  await page.getByRole("link", { name: "Tochten" }).click();
  await page.waitForURL(`${BASE}/leerkracht`);
  await page.waitForTimeout(2500);
  step("tour card: " + (await page.locator("article").first().innerText()).replace(/\n/g, " | "));
  await page.screenshot({ path: `${S}/04-tochten.png` });
  const tourUrl = await page.locator("article a").first().getAttribute("href");
  await page.goto(`${BASE}${tourUrl}/start`);
  await page.getByLabel("Klas").fill("2B");
  await page.getByRole("button", { name: "Start sessie" }).click();
  await page.waitForURL(/sessies\//);
  const code = await page.locator("p[aria-label^='Code']").innerText();
  step("session code: " + code + " valid=" + /^[A-HJ-NP-Z2-9]{6}$/.test(code));
  await page.screenshot({ path: `${S}/05-sessie.png` });
  await page.goto(`${BASE}/leerkracht`);
  step("recent: " + (await page.locator("li").first().innerText()).replace(/\n/g, " | "));
  await page.goto(`${BASE}${tourUrl}`);
  await page.locator(".maplibregl-canvas").waitFor();
  step("spot list after reload: " + (await page.locator("ol").innerText()).replace(/\n/g, " | "));
} catch (e) {
  console.log("FAILED:", e.message);
  process.exitCode = 1;
  await page.screenshot({ path: `${S}/fail.png` });
} finally {
  console.log("browser errors:", errors.length ? errors : "none");
  await browser.close();
  await admin.auth.admin.deleteUser(user.id);
  console.log("cleaned up test teacher");
}
