import { NextResponse, type NextRequest } from "next/server";
import { createTeacherClient } from "@/lib/supabase/server";

/**
 * Signs out and returns to the login page. Used when someone is logged in but
 * has no teacher row (a Server Component can't clear the auth cookies itself).
 */
export async function GET(request: NextRequest) {
  const supabase = await createTeacherClient();
  await supabase.auth.signOut();
  const fout = request.nextUrl.searchParams.get("fout");
  const target = new URL("/leerkracht/login", request.nextUrl.origin);
  if (fout) target.searchParams.set("fout", fout);
  return NextResponse.redirect(target);
}
