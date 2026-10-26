"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createTeacherClient } from "@/lib/supabase/server";

/**
 * Microsoft 365 / Entra ID login (Supabase "azure" provider), the only way
 * teachers log in. Student accounts are refused by the database (see the
 * teachers_microsoft_only migration). Teachers come back through /auth/callback.
 */
export async function signInWithMicrosoft() {
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const supabase = await createTeacherClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "azure",
    options: {
      // "email" is needed: Supabase identifies the account by e-mail address.
      scopes: "email",
      redirectTo: `${origin}/auth/callback?next=/leerkracht`,
    },
  });
  if (error || !data.url) redirect("/leerkracht/login?fout=microsoft");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createTeacherClient();
  await supabase.auth.signOut();
  redirect("/leerkracht/login");
}
