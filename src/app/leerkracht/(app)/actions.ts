"use server";

import { redirect } from "next/navigation";
import { createTeacherClient } from "@/lib/supabase/server";

export async function createTour() {
  const supabase = await createTeacherClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/leerkracht/login");

  const { data, error } = await supabase
    .from("tour")
    .insert({ teacher_id: user.id, title: "Nieuwe tocht" })
    .select("id")
    .single();
  if (error) throw error;
  redirect(`/leerkracht/tochten/${data.id}`);
}

export async function startSession(tourId: string, form: FormData) {
  const classLabel = String(form.get("class_label") ?? "").trim().slice(0, 20);
  const supabase = await createTeacherClient();
  const { data, error } = await supabase
    .from("session")
    .insert({
      tour_id: tourId,
      class_label: classLabel,
      status: "live",
      starts_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  redirect(`/leerkracht/sessies/${data.id}`);
}
