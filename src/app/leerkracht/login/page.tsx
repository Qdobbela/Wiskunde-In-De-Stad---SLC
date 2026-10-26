import { Button } from "@/components/ui/Button";
import { Sticker } from "@/components/ui/Sticker";
import { signInWithMicrosoft } from "./actions";
import styles from "./login.module.css";

export const metadata = { title: "Aanmelden · Wiskunde in de stad" };

const ERRORS: Record<string, string> = {
  microsoft: "Aanmelden met Microsoft lukte niet. Probeer het opnieuw.",
  geannuleerd: "Het aanmelden met Microsoft werd geannuleerd.",
  bevestigen: "Aanmelden lukte niet. Probeer het opnieuw.",
  student:
    "Dit is een leerlingenaccount. Leerlingen hebben geen account nodig: jullie doen mee met de sessiecode van je leerkracht.",
  "geen-leerkracht": "Dit account is geen leerkrachtaccount. Meld je aan met je Microsoft-account van school.",
};

/** Microsoft's four-square logo, in its brand colours (not design tokens). */
function MicrosoftLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ fout?: string }>;
}) {
  const { fout } = await searchParams;
  const error = fout ? (ERRORS[fout] ?? ERRORS.bevestigen) : undefined;

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <Sticker>Wiskunde in de stad</Sticker>
        <div className={styles.titel}>
          <span className="label">Voor leerkrachten</span>
          <h2>Aanmelden</h2>
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <form action={signInWithMicrosoft}>
          <Button type="submit" variant="outline" className={styles.microsoft}>
            <MicrosoftLogo />
            Aanmelden met Microsoft
          </Button>
        </form>

        <p className={styles.note}>Gebruik je Microsoft-account van school.</p>
      </div>
    </main>
  );
}
