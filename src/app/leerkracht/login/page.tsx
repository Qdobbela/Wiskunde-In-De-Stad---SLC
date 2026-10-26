"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Sticker } from "@/components/ui/Sticker";
import { BASE_PATH } from "@/lib/basePath";
import { supabase } from "@/lib/supabase/client";
import styles from "./login.module.css";

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

function Login() {
  const fout = useSearchParams().get("fout");
  const [error, setError] = useState(fout ? (ERRORS[fout] ?? ERRORS.bevestigen) : null);
  const [pending, setPending] = useState(false);

  /** Microsoft 365 / Entra ID (Supabase "azure"); student accounts are refused by the database. */
  async function signIn() {
    setPending(true);
    const { error } = await supabase().auth.signInWithOAuth({
      provider: "azure",
      options: {
        // "email" is needed: Supabase identifies the account by e-mail address.
        scopes: "email",
        redirectTo: `${window.location.origin}${BASE_PATH}/auth/callback/`,
      },
    });
    if (error) {
      setError(ERRORS.microsoft);
      setPending(false);
    }
  }

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
        <Button variant="outline" className={styles.microsoft} onClick={signIn} disabled={pending}>
          <MicrosoftLogo />
          Aanmelden met Microsoft
        </Button>
        <p className={styles.note}>Gebruik je Microsoft-account van school.</p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}
