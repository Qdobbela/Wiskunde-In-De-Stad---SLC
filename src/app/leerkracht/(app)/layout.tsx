"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { shortName } from "@/lib/teacher/format";
import { TeacherContext, type Teacher } from "@/lib/teacher/TeacherContext";
import { Sidebar } from "./Sidebar";
import styles from "./teacher.module.css";

/**
 * Guards the teacher area in the browser: no session → login page; signed in
 * but no teacher row (only Microsoft logins get one) → signed out with a
 * message. RLS protects the data either way.
 */
export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [teacher, setTeacher] = useState<Teacher | null>(null);

  useEffect(() => {
    (async () => {
      const db = supabase();
      const {
        data: { session },
      } = await db.auth.getSession();
      if (!session) {
        router.replace("/leerkracht/login/");
        return;
      }
      const { data } = await db.from("teacher").select("*").eq("id", session.user.id).maybeSingle();
      if (!data) {
        await db.auth.signOut();
        router.replace("/leerkracht/login/?fout=geen-leerkracht");
        return;
      }
      setTeacher(data);
    })();
  }, [router]);

  if (!teacher) {
    return <p className={styles.loading}>Laden…</p>;
  }

  return (
    <TeacherContext.Provider value={{ teacher, setTeacher }}>
      <div className={styles.shell}>
        <Sidebar name={shortName(teacher.name) || teacher.email} school={teacher.school} />
        <div className={styles.content}>{children}</div>
      </div>
    </TeacherContext.Provider>
  );
}
