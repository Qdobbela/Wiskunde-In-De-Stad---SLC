"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateProfile } from "@/lib/teacher/mutations";
import { useTeacher } from "@/lib/teacher/TeacherContext";
import layout from "../teacher.module.css";

/** Name and school. Microsoft only sends the name, so the school is added here. */
export default function ProfilePage() {
  const { teacher, setTeacher } = useTeacher();
  const [name, setName] = useState(teacher.name);
  const [school, setSchool] = useState(teacher.school);
  const [message, setMessage] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const result = await updateProfile(name, school);
    if (result.error) return setMessage(result.error);
    setTeacher({ ...teacher, name: name.trim(), school: school.trim() });
    setMessage("Opgeslagen.");
  }

  return (
    <>
      <header className={layout.header}>
        <div className={layout.titleBlock}>
          <span className={layout.eyebrow}>{teacher.email}</span>
          <h1 className={layout.title}>Profiel</h1>
        </div>
      </header>
      <form className={layout.panel} style={{ maxWidth: 560, gap: "var(--spacing-lg)" }} onSubmit={save}>
        <Input label="Naam" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <Input label="School" value={school} onChange={(e) => setSchool(e.target.value)} placeholder="Sint-Lievenscollege" maxLength={80} />
        {message && <p role="status">{message}</p>}
        <Button type="submit">Opslaan</Button>
      </form>
    </>
  );
}
