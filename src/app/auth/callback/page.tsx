"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

/**
 * Microsoft sends the teacher back here (through Supabase) with ?code=… .
 * supabase-js exchanges the code itself when it starts (PKCE); this page
 * waits for that and moves on.
 */
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const get = (key: string) => query.get(key) ?? hash.get(key);
    // Supabase reports a refused sign-up (the student check in the database)
    // as a server_error with "Database error saving new user".
    const error = get("error");
    if (error) {
      const description = get("error_description") ?? "";
      const reason =
        error === "access_denied" ? "geannuleerd" : /database error/i.test(description) ? "student" : "bevestigen";
      router.replace(`/leerkracht/login/?fout=${reason}`);
      return;
    }
    supabase()
      .auth.getSession()
      .then(({ data }) => router.replace(data.session ? "/leerkracht/" : "/leerkracht/login/?fout=bevestigen"));
  }, [router]);

  return <p style={{ padding: "var(--spacing-3xl)", fontWeight: 700 }}>Aanmelden…</p>;
}
