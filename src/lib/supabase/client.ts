"use client";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

let client: ReturnType<typeof createClient<Database>> | null = null;

/**
 * The browser's Supabase client. Teachers are signed in through it (session in
 * localStorage, PKCE for the Microsoft redirect); RLS decides what they see.
 * Students never use it: their phones talk to the "leerling" Edge Function.
 */
export function supabase() {
  client ??= createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true },
  });
  return client;
}
