import { notFound } from "next/navigation";
import { createTeacherClient } from "@/lib/supabase/server";
import { TourEditor } from "./TourEditor";

export const metadata = { title: "Tocht bewerken · Wiskunde in de stad" };

export default async function TourPage({ params }: { params: Promise<{ tourId: string }> }) {
  const { tourId } = await params;
  const supabase = await createTeacherClient();
  const { data: tour } = await supabase
    .from("tour")
    .select("id, title, location(id, position, name, lat, lng, radius_m, dwell_s, question(level))")
    .eq("id", tourId)
    .maybeSingle();
  if (!tour) notFound();

  const spots = [...tour.location]
    .sort((a, b) => a.position - b.position)
    .map(({ question, position: _position, ...loc }) => ({
      ...loc,
      levelsFilled: new Set(question.map((q) => q.level)).size,
    }));

  return <TourEditor tourId={tour.id} initialTitle={tour.title} initialSpots={spots} />;
}
