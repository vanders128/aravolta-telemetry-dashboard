import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.content} aria-labelledby="page-title">
        <p className={styles.eyebrow}>Aravolta engineering take-home</p>
        <h1 id="page-title">Device telemetry dashboard</h1>
        <p className={styles.description}>
          The application foundation is ready. Database-backed telemetry will be
          added in the next implementation phases.
        </p>
      </section>
    </main>
  );
}
