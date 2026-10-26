"use client";

import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/client";

/**
 * Client for the "leerling" Edge Function. A group is its secret token
 * (localStorage on the group's phone); the phone has a random id so the
 * server can tell when a second phone uses the same group.
 */

const TOKEN_KEY = "wids-groep";
const CODE_KEY = "wids-groep-code";
const DEVICE_KEY = "wids-toestel";

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function groupToken() {
  return read(TOKEN_KEY);
}

/** The session code of the stored group, to tell a new session apart. */
export function groupCode() {
  return read(CODE_KEY);
}

export function setGroupToken(token: string | null, code?: string) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      if (code) localStorage.setItem(CODE_KEY, code);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(CODE_KEY);
    }
  } catch {}
}

export function deviceId() {
  let id = read(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    try {
      localStorage.setItem(DEVICE_KEY, id);
    } catch {}
  }
  return id;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** POSTs to the Edge Function; throws ApiError with the server's Dutch message. */
export async function call<T>(action: string, body?: unknown | FormData): Promise<T> {
  const headers: Record<string, string> = { apikey: SUPABASE_KEY, "x-toestel": deviceId() };
  const token = groupToken();
  if (token) headers["x-groep"] = token;
  const isForm = body instanceof FormData;
  if (!isForm) headers["content-type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/leerling/${action}`, {
      method: "POST",
      headers,
      body: isForm ? body : JSON.stringify(body ?? {}),
      keepalive: !isForm,
    });
  } catch {
    throw new ApiError("Geen verbinding. Probeer opnieuw.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "Er ging iets mis.", res.status);
  return data as T;
}

// Response types of the Edge Function.

export type RouteSpot = {
  id: string;
  number: number;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  dwellS: number;
  done: boolean;
};

export type Level = "basis" | "gevorderd" | "expert";

/** Unlocked, but the group still picks a level for this spot. */
export type LevelChoice = {
  needsLevel: true;
  locationId: string;
  spotName: string;
  number: number;
  levels: { level: Level; maxPoints: number; needsPhoto: boolean }[];
};

export type OpenQuestion = {
  needsLevel: false;
  level: Level;
  locationId: string;
  spotName: string;
  number: number;
  body: string;
  answerType: "number" | "text" | "photo";
  unit: string | null;
  needsPhoto: boolean;
  photoPrompt: string | null;
  maxPoints: number;
  deadline: string | null;
};

export type GroupState = {
  team: { name: string };
  session: { endsAt: string | null; timeUp: boolean };
  route: RouteSpot[];
  question: OpenQuestion | LevelChoice | null;
  message: { id: string; body: string; created_at: string } | null;
  blocked: boolean;
};

export type PingResult =
  | { status: "skipped" | "question_open" | "finished" | "time_up" }
  | { status: "unlocked"; locationId: string }
  | {
      status: "walking" | "in_zone";
      target: string;
      distance: number;
      accurate: boolean;
      streakSeconds: number;
      dwellS: number;
      blocked: boolean;
    };

export type AnswerResult = {
  level: Level;
  correct: boolean | null;
  pending: boolean;
  points: number | null;
  maxPoints: number;
  value: string;
  unit: string | null;
  lockedAt: string;
  photoAt: string | null;
  expected: string | number | null;
};

export type Ranking = {
  place: number;
  rows: { place: number; name: string; points: number; isMe: boolean }[];
  done: number;
  total: number;
  seconds: number | null;
  pendingReview: boolean;
};
