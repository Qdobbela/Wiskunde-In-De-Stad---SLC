"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sticker } from "@/components/ui/Sticker";
import { signOut } from "../login/actions";
import styles from "./teacher.module.css";

const NAV = [
  { href: "/leerkracht", label: "Tochten", match: (p: string) => p === "/leerkracht" || p.startsWith("/leerkracht/tochten") || p.startsWith("/leerkracht/sessies") },
  { href: "/leerkracht/live", label: "Live", match: (p: string) => p.startsWith("/leerkracht/live") },
  { href: "/leerkracht/vragenbank", label: "Vragenbank", match: (p: string) => p.startsWith("/leerkracht/vragenbank") },
  { href: "/leerkracht/resultaten", label: "Resultaten", match: (p: string) => p.startsWith("/leerkracht/resultaten") },
];

export function Sidebar({ name, school }: { name: string; school: string }) {
  const pathname = usePathname();
  return (
    <nav className={styles.sidebar} aria-label="Hoofdmenu">
      <div className={styles.logo}>
        <Sticker>Wiskunde in de stad</Sticker>
      </div>
      {NAV.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[styles.navItem, active && styles.navActive].filter(Boolean).join(" ")}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
      <div className={styles.spacer} />
      <p className={styles.teacherName}>{name}</p>
      {school && <p className={styles.school}>{school}</p>}
      <form action={signOut}>
        <button type="submit" className={styles.signOut}>
          Afmelden
        </button>
      </form>
    </nav>
  );
}
