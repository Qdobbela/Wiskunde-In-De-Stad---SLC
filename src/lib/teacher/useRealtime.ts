"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";

type Table = "team" | "ping" | "unlock" | "answer" | "flag" | "session_message";

/** Safety net in case the Realtime connection drops. */
const FALLBACK_MS = 20_000;

/**
 * Calls `onChange` (at most every `throttleMs`) when rows in these tables
 * change. Realtime applies RLS, so a teacher only hears about their own
 * sessions.
 */
export function useRealtime(key: string, tables: { table: Table; filter?: string }[], onChange: () => void, throttleMs = 1500) {
  const callback = useRef(onChange);
  callback.current = onChange;
  const spec = JSON.stringify(tables);

  useEffect(() => {
    const db = supabase();
    let channel: ReturnType<typeof db.channel> | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        callback.current();
      }, throttleMs);
    };

    (async () => {
      // Join with the teacher's token: joining before the session has loaded
      // would subscribe anonymously, and RLS would then hide every row.
      const { data } = await db.auth.getSession();
      if (cancelled) return;
      if (data.session) await db.realtime.setAuth(data.session.access_token);
      channel = db.channel(`rt-${key}`);
      for (const { table, filter } of JSON.parse(spec) as { table: Table; filter?: string }[]) {
        channel.on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, fire);
      }
      channel.subscribe();
    })();

    const fallback = setInterval(() => callback.current(), FALLBACK_MS);
    return () => {
      cancelled = true;
      clearInterval(fallback);
      if (timer) clearTimeout(timer);
      if (channel) db.removeChannel(channel);
    };
  }, [key, spec, throttleMs]);
}
