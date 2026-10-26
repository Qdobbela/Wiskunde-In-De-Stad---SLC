"use client";

import { createContext, useContext } from "react";
import type { Database } from "@/lib/supabase/database.types";

export type Teacher = Database["public"]["Tables"]["teacher"]["Row"];

export const TeacherContext = createContext<{ teacher: Teacher; setTeacher: (t: Teacher) => void } | null>(null);

export function useTeacher() {
  const ctx = useContext(TeacherContext);
  if (!ctx) throw new Error("useTeacher outside the teacher layout");
  return ctx;
}
