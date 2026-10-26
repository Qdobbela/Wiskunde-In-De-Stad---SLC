// Shared helpers for the browser tests in scripts/e2e/.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

export const OUT = process.env.E2E_OUT ?? ".e2e";
mkdirSync(OUT, { recursive: true });
export const BASE = process.env.E2E_BASE ?? "http://localhost:3123";

/** The Supabase project URL, for the Edge Function. */
export const FUNCTIONS = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

export const step = (s) => console.log("•", s);

export function launch() {
  return chromium.launch({
    executablePath: CHROME,
    headless: true,
    // A fake camera that says yes, for the L04 permission step.
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });
}

/**
 * Teachers log in with Microsoft, which a test can't do. Instead: an e-mail
 * test user (needs the Email provider left on in Supabase) with a teacher row
 * inserted here. Delete it with admin.auth.admin.deleteUser(user.id); that
 * cascades to everything it made.
 */
export async function createTestTeacher({ withTeacherRow = true } = {}) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
  const password = crypto.randomUUID();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const user = data.user;
  if (withTeacherRow) {
    await admin.from("teacher").insert({ id: user.id, email, name: "Quinten Dobbelaere", school: "Sint-Lievenscollege" });
  }
  return { user, email, password };
}

/**
 * Logs the teacher in, in Node, and puts the session where supabase-js keeps
 * it in the browser (localStorage), before any page script runs.
 */
export async function loginTeacher(context, { email, password }) {
  const client = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
  await context.addInitScript(
    ([key, value]) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    [`sb-${ref}-auth-token`, JSON.stringify(data.session)],
  );
}

/** Collects page errors and console errors. */
export function watchErrors(page, errors) {
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
}
