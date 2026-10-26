import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Sticker } from "@/components/ui/Sticker";
import styles from "./home.module.css";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  // Supabase falls back to the Site URL when a redirect URL isn't allow-listed.
  const { code } = await searchParams;
  if (code) redirect(`/auth/callback?code=${encodeURIComponent(code)}`);

  return (
    <main className={styles.main}>
      <Sticker rotate={-3}>Gent</Sticker>
      <h1>Wiskunde in de stad</h1>
      <p>Een wiskundetocht door Gent.</p>
      <ButtonLink href="/leerkracht" variant="outline">
        Ik ben leerkracht
      </ButtonLink>
    </main>
  );
}
