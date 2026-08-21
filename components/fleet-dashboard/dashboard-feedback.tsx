import styles from "./telemetry-dashboard.module.css";

export function DashboardLoading() {
  return (
    <section
      className={styles.loadingState}
      role="status"
      aria-busy="true"
      aria-label="Loading fleet telemetry"
    >
      <span className={styles.srOnly}>Loading fleet telemetry</span>
      <div className={styles.loadingSummary} aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
      <div className={styles.loadingTable} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}

export function DashboardError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className={styles.errorState} role="alert">
      <p className={styles.stateEyebrow}>Fleet request failed</p>
      <h2>Telemetry is temporarily unavailable</h2>
      <p>{message}</p>
      <button type="button" onClick={onRetry}>
        Retry request
      </button>
    </section>
  );
}
