"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { must, useLoad } from "@/lib/useLoad";
import { TourEditor } from "./TourEditor";
import layout from "../teacher.module.css";

function Tour() {
  const id = useSearchParams().get("id") ?? "";
  const { data, error } = useLoad(async () => {
    const tour = must(
      await supabase()
        .from("tour")
        .select("id, title, location(id, position, name, lat, lng, radius_m, dwell_s, question(level))")
        .eq("id", id)
        .maybeSingle(),
    );
    if (!tour) throw new Error("Deze tocht bestaat niet (meer).");
    const spots = [...tour.location]
      .sort((a, b) => a.position - b.position)
      .map(({ question, position: _position, ...loc }) => ({
        ...loc,
        levelsFilled: new Set(question.map((q) => q.level)).size,
      }));
    return { tour, spots };
  }, [id]);

  if (error) return <p className={layout.error}>{error}</p>;
  if (!data) return <p className={layout.loading}>Laden…</p>;
  return <TourEditor key={data.tour.id} tourId={data.tour.id} initialTitle={data.tour.title} initialSpots={data.spots} />;
}

/** T02 Tocht maken. */
export default function TourPage() {
  return (
    <Suspense>
      <Tour />
    </Suspense>
  );
}
