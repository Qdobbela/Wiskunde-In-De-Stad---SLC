import layout from "../teacher.module.css";

export const metadata = { title: "Vragenbank · Wiskunde in de stad" };

export default function VragenbankPage() {
  return (
    <>
      <header className={layout.header}>
        <div className={layout.titleBlock}>
          <span className={layout.eyebrow}>Binnenkort</span>
          <h1 className={layout.title}>Vragenbank</h1>
        </div>
      </header>
      <p className={layout.panel}>Dit scherm wordt in een volgende stap gebouwd. Zie TODO.md.</p>
    </>
  );
}
