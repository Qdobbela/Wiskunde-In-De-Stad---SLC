"use server";

import { revalidatePath } from "next/cache";
import { createTeacherClient } from "@/lib/supabase/server";

export async function closeSession(sessionId: string) {
  const supabase = await createTeacherClient();
  const { error } = await supabase
    .from("session")
    .update({ status: "closed", ends_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) throw error;
  revalidatePath(`/leerkracht/sessies/${sessionId}`);
  revalidatePath("/leerkracht");
}
