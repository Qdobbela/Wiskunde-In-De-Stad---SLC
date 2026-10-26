"use client";

import { MapView, type MapPin } from "@/components/map/MapView";
import styles from "./tochten.module.css";

/** Non-interactive map preview on a tour card. */
export function MiniMap({ spots }: { spots: MapPin[] }) {
  return <MapView pins={spots} interactive={false} className={styles.miniMap} />;
}
