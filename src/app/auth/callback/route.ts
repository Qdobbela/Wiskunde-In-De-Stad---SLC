import { NextResponse, type NextRequest } from "next/server";
import { createTeacherClient } from "@/lib/supabase/server";

/** Where Microsoft (through Supabase) sends the teacher back after logging in. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/leerkracht";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/leerkracht";

  if (code) {
    const supabase = await createTeacherClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
  }

  // Supabase reports a refused sign-up (our student check in the database)
  // as a server_error with "Database error saving new user".
  const error = searchParams.get("error");
  const description = searchParams.get("error_description") ?? "";
  const reason =
    error === "access_denied"
      ? "geannuleerd"
      : /database error/i.test(description)
        ? "student"
        : "bevestigen";
  return NextResponse.redirect(`${origin}/leerkracht/login?fout=${reason}`);
}
