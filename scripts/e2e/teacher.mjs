// End-to-end check of the teacher screens (login guard, T01 to T03, starting a
// session, preview, question bank, profile) in your installed Chrome, against
// the real Supabase project. Creates a throwaway teacher and deletes it (with
// everything it made) afterwards.
//
//   npm run build && npm run serve   (in another terminal)
//   npm run e2e:teacher
import { admin, BASE, OUT, createTestTeacher, launch, loginTeacher, step, watchErrors } from "./helpers.mjs";

const teacher = await createTestTeacher({ withTeacherRow: false });
const browser = await launch();
const errors = [];
try {
  // Logged out: the login page, Microsoft only.
  const anon = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watchErrors(anon, errors);
  await anon.goto(`${BASE}/leerkracht/`);
  await anon.waitForURL(/\/leerkracht\/login\//);
  step("logged out → login, buttons: " + (await anon.getByRole("button").allInnerTexts()).join(", "));
  await anon.screenshot({ path: `${OUT}/01-login.png` });

  // Signed in, but no teacher row: signed out with a message.
  const noRow = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await loginTeacher(noRow, teacher);
  const noRowPage = await noRow.newPage();
  await noRowPage.goto(`${BASE}/leerkracht/`);
  await noRowPage.waitForURL(/fout=geen-leerkracht/);
  step("no teacher row → " + (await noRowPage.locator("p[role=alert]").innerText()));

  // A real teacher.
  await admin.from("teacher").insert({ id: teacher.user.id, email: teacher.email, name: "Quinten Dobbelaere", school: "Sint-Lievenscollege" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await loginTeacher(context, teacher);
  const page = await context.newPage();
  watchErrors(page, errors);
  await page.goto(`${BASE}/leerkracht/`);
  await page.getByRole("heading", { name: "Jouw tochten" }).waitFor();
  step("sidebar: " + (await page.locator("nav").innerText()).replace(/\n+/g, " | "));

  await page.getByRole("button", { name: "+ Nieuwe tocht" }).click();
  await page.waitForURL(/\/leerkracht\/tocht\/\?id=/);
  const tourId = new URL(page.url()).searchParams.get("id");
  await page.locator(".maplibregl-canvas").waitFor();
  await page.waitForTimeout(2500);
  await page.getByLabel("Tocht bewerken").fill("Middeleeuws Gent");
  const box = await page.locator(".maplibregl-canvas").boundingBox();
  for (const [fx, fy] of [[0.3, 0.3], [0.55, 0.5], [0.75, 0.7]]) {
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    await page.waitForTimeout(300);
  }
  step("spots in list: " + (await page.locator("ol li").count()));
  await page.getByLabel("Naam van de spot").fill("Gravensteen");
  await page.screenshot({ path: `${OUT}/02-tour.png` });
  await page.getByRole("button", { name: "Opslaan" }).click();
  await page.getByRole("button", { name: "Opgeslagen" }).waitFor();
  step("tour saved");

  await page.getByRole("button", { name: "Vragen" }).click();
  await page.waitForURL(/\/leerkracht\/vragen\/\?spot=/);
  await page.locator("h1", { hasText: "Gravensteen" }).waitFor();
  for (const level of ["Basis", "Gevorderd", "Expert"]) {
    await page.getByRole("radio", { name: new RegExp(`^${level}`) }).click();
    await page.getByLabel("Vraag", { exact: true }).fill("Een ridder loopt {n} keer rond een vierkante toren met zijden van {z} m. Hoeveel meter stapt hij in totaal?");
    await page.getByPlaceholder("= n × 4 × z").fill("= n × 4 × z");
    await page.getByLabel("n van", { exact: true }).fill("2");
    await page.getByLabel("n tot", { exact: true }).fill("5");
    await page.getByLabel("z van", { exact: true }).fill("8");
    await page.getByLabel("z tot", { exact: true }).fill("15");
  }
  await page.getByLabel("Eenheid", { exact: true }).fill("m");
  await page.getByRole("switch", { name: "Foto verplicht" }).click();
  await page.getByPlaceholder("de groep op de foto, met de toren erachter").fill("de groep op de foto, met de toren erachter");
  step("preview: " + (await page.locator("aside").innerText()).replace(/\n+/g, " | "));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/03-questions.png` });
  await page.getByRole("button", { name: "Opslaan" }).click();
  await page.getByRole("button", { name: "Opgeslagen" }).waitFor({ timeout: 10000 });
  step("questions saved");
  await page.getByPlaceholder("= n × 4 × z").fill("= n × (4");
  step("formula error: " + (await page.locator("p", { hasText: "Haakje" }).first().innerText()));

  await page.getByRole("link", { name: "Tochten" }).click();
  await page.getByRole("heading", { name: "Jouw tochten" }).waitFor();
  await page.locator("article").first().waitFor();
  await page.waitForTimeout(2500);
  step("tour card: " + (await page.locator("article").first().innerText()).replace(/\n+/g, " | "));
  await page.screenshot({ path: `${OUT}/04-tochten.png` });

  await page.goto(`${BASE}/leerkracht/start/?tocht=${tourId}`);
  await page.getByLabel("Klas").fill("2B");
  await page.getByRole("button", { name: "Start sessie" }).click();
  await page.waitForURL(/\/leerkracht\/sessie\/\?id=/);
  const code = await page.locator("p[aria-label^='Code']").innerText();
  step("session code: " + code + " valid=" + /^[A-HJ-NP-Z2-9]{6}$/.test(code));
  await page.locator("[aria-label^='QR-code'] svg").waitFor();
  step("QR code drawn for " + (await page.locator("[aria-label^='QR-code']").getAttribute("aria-label")));
  await page.screenshot({ path: `${OUT}/05-sessie.png` });

  for (const [path, heading] of [
    [`/leerkracht/voorbeeld/?tocht=${tourId}`, "Middeleeuws Gent"],
    ["/leerkracht/vragenbank/", "Vragenbank"],
    ["/leerkracht/profiel/", "Profiel"],
    ["/leerkracht/live/", null],
    ["/leerkracht/resultaten/", "Alle sessies"],
  ]) {
    await page.goto(`${BASE}${path}`);
    if (heading) await page.getByRole("heading", { name: heading, exact: true }).waitFor();
    else await page.waitForURL(/live\/\?sessie=/);
    step(`${path} ok`);
  }
  await page.goto(`${BASE}/leerkracht/voorbeeld/?tocht=${tourId}`);
  await page.getByRole("radio", { name: "Expert" }).click();
  step("preview (expert): " + (await page.locator("p", { hasText: "ridder" }).first().innerText()));
  await page.screenshot({ path: `${OUT}/06-voorbeeld.png` });
} catch (e) {
  console.log("FAILED:", e.message);
  process.exitCode = 1;
} finally {
  console.log("browser errors:", errors.length ? errors : "none");
  await browser.close();
  await admin.auth.admin.deleteUser(teacher.user.id);
  console.log("cleaned up test teacher");
}
