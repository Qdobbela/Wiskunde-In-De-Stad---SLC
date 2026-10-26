"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Kaartpin } from "@/components/map/Kaartpin";
import { MapView, type MapPin } from "@/components/map/MapView";
import { Button } from "@/components/ui/Button";
import { Sticker } from "@/components/ui/Sticker";
import { deleteTour, saveTour, type SpotInput } from "./actions";
import layout from "../../teacher.module.css";
import styles from "./tour.module.css";

type Spot = SpotInput & { levelsFilled: number };

type TourEditorProps = {
  tourId: string;
  initialTitle: string;
  initialSpots: Spot[];
};

export function TourEditor({ tourId, initialTitle, initialSpots }: TourEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [spots, setSpots] = useState<Spot[]>(initialSpots);
  const [selectedId, setSelectedId] = useState<string | null>(initialSpots[0]?.id ?? null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saving, startSaving] = useTransition();

  const selected = spots.find((s) => s.id === selectedId) ?? null;
  const selectedIndex = spots.findIndex((s) => s.id === selectedId);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function change(update: (spots: Spot[]) => Spot[]) {
    setSpots(update);
    setDirty(true);
    setError(null);
  }

  function updateSelected(patch: Partial<Spot>) {
    change((all) => all.map((s) => (s.id === selectedId ? { ...s, ...patch } : s)));
  }

  function addSpot({ lat, lng }: { lat: number; lng: number }) {
    const spot: Spot = {
      id: crypto.randomUUID(),
      name: `Spot ${spots.length + 1}`,
      lat,
      lng,
      radius_m: 25,
      dwell_s: 30,
      levelsFilled: 0,
    };
    change((all) => [...all, spot]);
    setSelectedId(spot.id);
  }

  function removeSelected() {
    if (!selected) return;
    const hasQuestions = selected.levelsFilled > 0;
    if (hasQuestions && !confirm(`${selected.name} en de vragen van deze spot verwijderen?`)) return;
    change((all) => all.filter((s) => s.id !== selected.id));
    setSelectedId(null);
  }

  function move(from: number, to: number) {
    if (from === to) return;
    change((all) => {
      const next = [...all];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  function save(then?: () => void) {
    startSaving(async () => {
      const result = await saveTour(
        tourId,
        title,
        spots.map(({ levelsFilled: _levels, ...s }) => s),
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setDirty(false);
      router.refresh();
      then?.();
    });
  }

  function openQuestions() {
    if (!selected) return;
    const go = () => router.push(`/leerkracht/tochten/${tourId}/spots/${selected.id}`);
    if (dirty) save(go);
    else go();
  }

  function removeTour() {
    if (!confirm(`De tocht "${title}" met alle spots en vragen verwijderen?`)) return;
    startSaving(async () => {
      const result = await deleteTour(tourId);
      if (result.error) setError(result.error);
      else router.push("/leerkracht");
    });
  }

  const pins: MapPin[] = useMemo(
    () =>
      spots.map((s, i) => ({
        id: s.id,
        lat: s.lat,
        lng: s.lng,
        label: i + 1,
        status: s.id === selectedId ? "hier" : s.levelsFilled === 3 ? "opgelost" : "vergrendeld",
        radiusM: s.id === selectedId ? s.radius_m : undefined,
      })),
    [spots, selectedId],
  );

  return (
    <>
      <header className={layout.header}>
        <div className={layout.titleBlock}>
          <label htmlFor="tour-title" className={layout.eyebrow}>
            Tocht bewerken
          </label>
          <input
            id="tour-title"
            className={`${layout.title} ${styles.titleInput}`}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
            }}
            maxLength={60}
          />
        </div>
        <div className={layout.actions}>
          <Button variant="outline" className={styles.previewButton} disabled title="Komt eraan">
            Bekijk als leerling
          </Button>
          <Button className={styles.saveButton} onClick={() => save()} disabled={saving || !dirty}>
            {saving ? "Bezig…" : dirty ? "Opslaan" : "Opgeslagen"}
          </Button>
        </div>
      </header>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.workspace}>
        <section className={`${layout.panel} ${styles.spotList}`} aria-label="Spots">
          <div className={styles.listHeader}>
            <h2 className={styles.listTitle}>Spots ({spots.length})</h2>
            {spots.length > 1 && <span className={styles.hint}>Sleep om te ordenen</span>}
          </div>

          <ol className={styles.spots}>
            {spots.map((spot, i) => (
              <li
                key={spot.id}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) move(dragIndex, i);
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
                className={[
                  styles.spotRow,
                  spot.id === selectedId && styles.spotSelected,
                  dragIndex === i && styles.spotDragging,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <button type="button" className={styles.spotButton} onClick={() => setSelectedId(spot.id)}>
                  <Kaartpin
                    size="s"
                    label={i + 1}
                    status={spot.levelsFilled === 3 ? "opgelost" : "vergrendeld"}
                  />
                  <span className={styles.spotText}>
                    <span className={styles.spotName}>{spot.name}</span>
                    <span
                      className={[styles.spotMeta, spot.levelsFilled < 3 && styles.spotMetaMissing]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      Straal {spot.radius_m} m · {spot.levelsFilled}/3 niveaus ingevuld
                    </span>
                  </span>
                </button>
                <span className={styles.handle} aria-hidden>
                  ::
                </span>
              </li>
            ))}
          </ol>

          {spots.length === 0 && (
            <p className={styles.hint}>Klik op de kaart om je eerste spot te prikken.</p>
          )}

          <div className={styles.listSpacer} />
          <Button variant="outline" onClick={removeTour} className={styles.deleteTour}>
            Tocht verwijderen
          </Button>
        </section>

        <div className={styles.mapColumn}>
          <div className={styles.mapWrap}>
            <MapView
              pins={pins}
              fitKey={tourId}
              onMapClick={addSpot}
              onPinClick={setSelectedId}
              onPinDrag={(id, lngLat) =>
                change((all) => all.map((s) => (s.id === id ? { ...s, ...lngLat } : s)))
              }
              className={styles.map}
            />
            <Sticker tone="dark" rotate={1} className={styles.mapTip}>
              Klik op de kaart om een spot te prikken
            </Sticker>
          </div>

          {selected ? (
            <section className={`${layout.panel} ${styles.spotEditor}`} aria-label="Spot bewerken">
              <div className={styles.editorHeader}>
                <input
                  className={styles.spotNameInput}
                  value={selected.name}
                  onChange={(e) => updateSelected({ name: e.target.value })}
                  aria-label="Naam van de spot"
                  maxLength={60}
                />
                <Button variant="secondary" className={styles.questionsButton} onClick={openQuestions} disabled={saving}>
                  Vragen
                </Button>
              </div>
              <div className={styles.fields}>
                <label className={styles.field}>
                  <span className={layout.sectionLabel}>Straal</span>
                  <span className={styles.numberField}>
                    <input
                      type="number"
                      min={5}
                      max={500}
                      step={5}
                      value={selected.radius_m}
                      onChange={(e) => updateSelected({ radius_m: Number(e.target.value) })}
                    />
                    m
                  </span>
                </label>
                <div className={styles.field}>
                  <span className={layout.sectionLabel}>Coördinaten</span>
                  <span className={styles.value}>
                    {selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}
                  </span>
                </div>
                <label className={styles.field}>
                  <span className={layout.sectionLabel}>Blijftijd</span>
                  <span className={styles.numberField}>
                    <input
                      type="number"
                      min={0}
                      max={600}
                      step={5}
                      value={selected.dwell_s}
                      onChange={(e) => updateSelected({ dwell_s: Number(e.target.value) })}
                    />
                    sec
                  </span>
                </label>
                <div className={styles.fieldSpacer} />
                <button type="button" className={styles.removeSpot} onClick={removeSelected}>
                  Spot {selectedIndex + 1} verwijderen
                </button>
              </div>
            </section>
          ) : (
            <section className={`${layout.panel} ${styles.spotEditor}`}>
              <p className={styles.hint}>Kies een spot in de lijst of prik een nieuwe op de kaart.</p>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
