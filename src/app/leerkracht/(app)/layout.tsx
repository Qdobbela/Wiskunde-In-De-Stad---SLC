import { getTeacher, shortName } from "@/lib/teacher/data";
import { Sidebar } from "./Sidebar";
import styles from "./teacher.module.css";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const teacher = await getTeacher();
  return (
    <div className={styles.shell}>
      <Sidebar name={shortName(teacher.name) || teacher.email} school={teacher.school} />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
