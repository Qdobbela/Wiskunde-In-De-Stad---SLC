"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { groupToken } from "@/lib/student/api";
import { JoinFlow } from "./JoinFlow";

/** L01 to L04. A phone that's already in a group goes straight to its map. */
export default function StartPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (groupToken()) router.replace("/tocht/");
    else setReady(true);
  }, [router]);

  return ready ? <JoinFlow /> : null;
}
