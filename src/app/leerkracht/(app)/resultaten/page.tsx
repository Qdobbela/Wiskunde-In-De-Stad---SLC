import layout from "../teacher.module.css";

export const metadata = { title: "Resultaten · Wiskunde in de stad" };

export default function ResultatenPage() {
  return (
    <>
      <header className={layout.header}>
        <div className={layout.titleBlock}>
          <span className={layout.eyebrow}>Binnenkort</span>
          <h1 className={layout.title}>Resultaten</h1>
        </div>
      </header>
      <p className={layout.panel}>Dit scherm wordt in een volgende stap gebouwd. Zie TODO.md.</p>
    </>
  );
}
