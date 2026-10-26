"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Sticker } from "@/components/ui/Sticker";
import { supabase } from "@/lib/supabase/client";
import styles from "./teacher.module.css";

const NAV = [
  { href: "/leerkracht/", label: "Tochten", match: (p: string) => /^\/leerkracht\/?$|\/leerkracht\/(tocht|vragen|start|sessie|voorbeeld)/.test(p) },
  { href: "/leerkracht/live/", label: "Live", match: (p: string) => /\/leerkracht\/(live|groep)/.test(p) },
  { href: "/leerkracht/vragenbank/", label: "Vragenbank", match: (p: string) => p.includes("/leerkracht/vragenbank") },
  { href: "/leerkracht/resultaten/", label: "Resultaten", match: (p: string) => p.includes("/leerkracht/resultaten") },
];

export function Sidebar({ name, school }: { name: string; school: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await supabase().auth.signOut();
    router.replace("/leerkracht/login/");
  }

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
      <Link href="/leerkracht/profiel/" className={styles.profile} title="Profiel aanpassen">
        <span className={styles.teacherName}>{name}</span>
        <span className={styles.school}>{school || "School toevoegen"}</span>
      </Link>
      <button type="button" className={styles.signOut} onClick={signOut}>
        Afmelden
      </button>
    </nav>
  );
}
