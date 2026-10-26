"use client";

import { useEffect, useRef, useState } from "react";
import { LngLatBounds, Map as MapLibreMap, Marker, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { circlePolygon, GENT_CENTER, loadMapStyle } from "@/lib/map/style";
import { kaartpinClassName, kaartpinDraggableClass, type PinStatus } from "./Kaartpin";
import styles from "./MapView.module.css";

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  label: string | number;
  status: PinStatus;
  /** Draws the unlock zone around this pin. */
  radiusM?: number;
};

type MapViewProps = {
  pins: MapPin[];
  interactive?: boolean;
  /** Fit the view to the pins whenever this key changes. */
  fitKey?: string;
  onMapClick?: (lngLat: { lat: number; lng: number }) => void;
  onPinClick?: (id: string) => void;
  onPinDrag?: (id: string, lngLat: { lat: number; lng: number }) => void;
  className?: string;
};

const ZONE_SOURCE = "zones";

export function MapView({
  pins,
  interactive = true,
  fitKey,
  onMapClick,
  onPinClick,
  onPinDrag,
  className,
}: MapViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef(new globalThis.Map<string, Marker>());
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Keep the latest callbacks without re-creating the map.
  const handlers = useRef({ onMapClick, onPinClick, onPinDrag });
  handlers.current = { onMapClick, onPinClick, onPinDrag };

  useEffect(() => {
    let cancelled = false;
    loadMapStyle()
      .then((style) => {
        if (cancelled || !container.current) return;
        const instance = new MapLibreMap({
          container: container.current,
          style,
          center: GENT_CENTER,
          zoom: 15,
          interactive,
          attributionControl: { compact: true },
        });
        instance.on("load", () => {
          const zone = getComputedStyle(document.documentElement)
            .getPropertyValue("--color-action-primary")
            .trim();
          instance.addSource(ZONE_SOURCE, {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          instance.addLayer({
            id: "zone-fill",
            type: "fill",
            source: ZONE_SOURCE,
            paint: { "fill-color": zone, "fill-opacity": 0.18 },
          });
          instance.addLayer({
            id: "zone-line",
            type: "line",
            source: ZONE_SOURCE,
            paint: { "line-color": zone, "line-width": 2, "line-dasharray": [3, 2] },
          });
          // Small previews: keep the attribution behind its (i) button.
          if (!interactive) {
            container.current
              ?.querySelector(".maplibregl-ctrl-attrib")
              ?.classList.remove("maplibregl-compact-show");
          }
          setReady(true);
        });
        instance.on("click", (e) => {
          handlers.current.onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        });
        map.current = instance;
      })
      .catch(() => setFailed(true));

    const currentMarkers = markers.current;
    return () => {
      cancelled = true;
      currentMarkers.clear();
      map.current?.remove();
      map.current = null;
    };
  }, [interactive]);

  // Sync markers and zones with the pins.
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    const draggable = Boolean(onPinDrag);
    const seen = new Set<string>();

    for (const pin of pins) {
      seen.add(pin.id);
      let marker = markers.current.get(pin.id);
      if (!marker) {
        const el = document.createElement("button");
        el.type = "button";
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          handlers.current.onPinClick?.(pin.id);
        });
        marker = new Marker({ element: el, draggable })
          .setLngLat([pin.lng, pin.lat])
          .addTo(instance);
        marker.on("dragend", () => {
          const { lat, lng } = marker!.getLngLat();
          handlers.current.onPinDrag?.(pin.id, { lat, lng });
        });
        markers.current.set(pin.id, marker);
      }
      const el = marker.getElement();
      // Swap only our own classes; MapLibre keeps its positioning classes.
      const pinClasses = [kaartpinClassName(pin.status), draggable ? kaartpinDraggableClass : ""]
        .join(" ")
        .split(" ")
        .filter(Boolean);
      el.classList.remove(...(el.dataset.pinClasses?.split(" ").filter(Boolean) ?? []));
      el.classList.add(...pinClasses);
      el.dataset.pinClasses = pinClasses.join(" ");
      el.textContent = String(pin.label);
      el.setAttribute("aria-label", `Spot ${pin.label}`);
      marker.setLngLat([pin.lng, pin.lat]);
    }

    for (const [id, marker] of markers.current) {
      if (!seen.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    }

    const zones = pins
      .filter((p) => p.radiusM)
      .map((p) => circlePolygon(p.lng, p.lat, p.radiusM!));
    (instance.getSource(ZONE_SOURCE) as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: zones,
    });
  }, [pins, ready, onPinDrag]);

  // Fit to the pins on first load and when fitKey changes.
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || pins.length === 0) return;
    if (pins.length === 1) {
      instance.jumpTo({ center: [pins[0].lng, pins[0].lat], zoom: 16 });
      return;
    }
    const bounds = new LngLatBounds();
    for (const p of pins) bounds.extend([p.lng, p.lat]);
    // Room for the 48px pins, also on the 150px-high card previews.
    const { clientWidth, clientHeight } = instance.getContainer();
    const padding = Math.min(56, Math.floor(Math.min(clientWidth, clientHeight) / 4));
    instance.fitBounds(bounds, { padding, maxZoom: 17, duration: 0 });
    // Only refit on purpose, not on every pin move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fitKey]);

  return (
    <div className={[styles.map, className].filter(Boolean).join(" ")}>
      <div ref={container} className={styles.canvas} />
      {failed && <p className={styles.error}>De kaart kon niet laden.</p>}
    </div>
  );
}
