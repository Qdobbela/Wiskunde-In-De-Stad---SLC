"use client";

import { useEffect, useRef, useState } from "react";
import { LngLatBounds, Map as MapLibreMap, Marker, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { asset } from "@/lib/basePath";
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
  /** Red alarm ring: a group with a suspicious flag (T04). */
  alert?: boolean;
};

export type MyPosition = { lat: number; lng: number; accuracyM: number };

type MapViewProps = {
  pins: MapPin[];
  /** The group's own position: blue dot with its accuracy circle. */
  me?: MyPosition | null;
  /** Dotted route line, as [lng, lat] points. */
  routeLine?: [number, number][];
  /** Black name label above one pin, e.g. the next spot. */
  label?: { pinId: string; text: string } | null;
  interactive?: boolean;
  /** Fit the view to the pins whenever this key changes. */
  fitKey?: string;
  onMapClick?: (lngLat: { lat: number; lng: number }) => void;
  onPinClick?: (id: string) => void;
  onPinDrag?: (id: string, lngLat: { lat: number; lng: number }) => void;
  className?: string;
};

const ZONE_SOURCE = "zones";
const ROUTE_SOURCE = "route";
const ACCURACY_SOURCE = "me-accuracy";
const EMPTY = { type: "FeatureCollection" as const, features: [] };

function token(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function MapView({
  pins,
  me,
  routeLine,
  label,
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
  const meMarker = useRef<Marker | null>(null);
  const labelMarker = useRef<Marker | null>(null);
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
          const zone = token("--color-action-primary");
          instance.addSource(ZONE_SOURCE, { type: "geojson", data: EMPTY });
          instance.addSource(ROUTE_SOURCE, { type: "geojson", data: EMPTY });
          instance.addSource(ACCURACY_SOURCE, { type: "geojson", data: EMPTY });
          instance.addLayer({
            id: "route-line",
            type: "line",
            source: ROUTE_SOURCE,
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": token("--color-border-default"), "line-width": 3, "line-dasharray": [0.5, 2] },
          });
          instance.addLayer({
            id: "me-accuracy",
            type: "fill",
            source: ACCURACY_SOURCE,
            paint: { "fill-color": token("--color-action-info"), "fill-opacity": 0.18 },
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
          // Keep the map credits behind their (i) button; they would cover
          // a big part of a phone-sized or preview map.
          container.current
            ?.querySelector(".maplibregl-ctrl-attrib")
            ?.classList.remove("maplibregl-compact-show");
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
      meMarker.current = null;
      labelMarker.current = null;
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
      el.setAttribute("aria-label", pin.status === "groep" ? `Groep ${pin.label}` : `Spot ${pin.label}`);
      if (pin.alert) {
        const ring = document.createElement("img");
        ring.src = asset("/figma/alarm.svg");
        ring.alt = "";
        ring.className = styles.alarm;
        el.prepend(ring);
        el.classList.add(styles.alerting);
      } else {
        el.classList.remove(styles.alerting);
      }
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

  // The group's own position.
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    if (!me) {
      meMarker.current?.remove();
      meMarker.current = null;
      (instance.getSource(ACCURACY_SOURCE) as GeoJSONSource | undefined)?.setData(EMPTY);
      return;
    }
    if (!meMarker.current) {
      const el = document.createElement("div");
      el.className = styles.me;
      el.setAttribute("aria-label", "Jullie positie");
      meMarker.current = new Marker({ element: el }).setLngLat([me.lng, me.lat]).addTo(instance);
    }
    meMarker.current.setLngLat([me.lng, me.lat]);
    (instance.getSource(ACCURACY_SOURCE) as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: [circlePolygon(me.lng, me.lat, me.accuracyM)],
    });
  }, [me, ready]);

  // Dotted route line.
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    (instance.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined)?.setData(
      routeLine && routeLine.length > 1
        ? { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: routeLine } }
        : EMPTY,
    );
  }, [routeLine, ready]);

  // Name label above a pin.
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    const pin = label ? pins.find((p) => p.id === label.pinId) : undefined;
    if (!label || !pin) {
      labelMarker.current?.remove();
      labelMarker.current = null;
      return;
    }
    if (!labelMarker.current) {
      const el = document.createElement("div");
      el.className = styles.label;
      labelMarker.current = new Marker({ element: el, anchor: "bottom", offset: [0, -30] })
        .setLngLat([pin.lng, pin.lat])
        .addTo(instance);
    }
    labelMarker.current.getElement().textContent = label.text;
    labelMarker.current.setLngLat([pin.lng, pin.lat]);
  }, [label, pins, ready]);

  // Fit to the pins (and the group's position) on first load and when fitKey changes.
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    const points: [number, number][] = pins.map((p) => [p.lng, p.lat]);
    if (me) points.push([me.lng, me.lat]);
    if (points.length === 0) return;
    if (points.length === 1) {
      instance.jumpTo({ center: points[0], zoom: 16 });
      return;
    }
    const bounds = new LngLatBounds();
    for (const p of points) bounds.extend(p);
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
