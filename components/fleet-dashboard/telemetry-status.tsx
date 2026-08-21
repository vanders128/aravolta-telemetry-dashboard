import {
  OPERATOR_STATE_LABELS,
  type TelemetryEvaluation,
} from "@/lib/telemetry/operator-state";

import styles from "./telemetry-dashboard.module.css";

export function TelemetryStatus({
  evaluation,
  compact = false,
}: {
  evaluation: TelemetryEvaluation;
  compact?: boolean;
}) {
  return (
    <span
      className={`${styles.telemetryStatus} ${compact ? styles.telemetryStatusCompact : ""}`}
      data-status={evaluation.state}
      title={evaluation.reason}
    >
      <span className={styles.statusDot} aria-hidden="true" />
      <span>{OPERATOR_STATE_LABELS[evaluation.state]}</span>
    </span>
  );
}
