import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;

/** Acts as the signed-in teacher; RLS applies. */
export async function createTeacherClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component; the middleware refreshes the session.
        }
      },
    },
  });
}

/**
 * Bypasses RLS. Only for student server routes and the unlock/grading logic,
 * which do their own checks. Never import this into client code.
 */
export function createAdminClient() {
  return createClient<Database>(url, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
