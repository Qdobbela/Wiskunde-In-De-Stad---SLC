"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeCode } from "@/lib/geo";
import { groupCode, groupToken, setGroupToken } from "@/lib/student/api";
import { JoinFlow } from "./JoinFlow";

/**
 * L01 to L04. `?sessie=CODE` comes from the QR code on the teacher's screen
 * and fills in the code. A phone that's already in a group of that session
 * goes straight to its map; a QR code for another session starts fresh.
 */
export default function StartPage() {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    const fromQr = new URLSearchParams(window.location.search).get("sessie");
    const qrCode = fromQr ? normalizeCode(fromQr) : "";
    if (groupToken()) {
      if (!qrCode || qrCode === groupCode()) {
        router.replace("/tocht/");
        return;
      }
      setGroupToken(null);
    }
    setCode(qrCode);
  }, [router]);

  return code === null ? null : <JoinFlow initialCode={code || undefined} />;
}
