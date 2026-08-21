import type { FleetSummary as FleetSummaryValues } from "@/lib/telemetry/fleet-dashboard";
import { formatPower } from "@/lib/telemetry/formatters";

import styles from "./telemetry-dashboard.module.css";

export function FleetSummary({ summary }: { summary: FleetSummaryValues }) {
  const cards = [
    {
      label: "Total devices",
      value: summary.totalDevices.toLocaleString("en-US"),
      detail: "Registered assets",
    },
    {
      label: "Normal / current",
      value: summary.normalCurrent.toLocaleString("en-US"),
      detail: "Current and within thresholds",
    },
    {
      label: "Needs attention",
      value: summary.needsAttention.toLocaleString("en-US"),
      detail: "Warning or critical",
    },
    {
      label: "Stale / no data",
      value: summary.staleOrNoData.toLocaleString("en-US"),
      detail: "Not current",
    },
    {
      label: "Current aggregate power",
      value:
        summary.currentAggregatePower === null
          ? "No data"
          : formatPower(summary.currentAggregatePower),
      detail: "Current telemetry only",
    },
  ];

  return (
    <section aria-labelledby="fleet-summary-title">
      <h2 id="fleet-summary-title" className={styles.srOnly}>
        Fleet summary
      </h2>
      <dl className={styles.summaryGrid}>
        {cards.map((card) => (
          <div className={styles.summaryCard} key={card.label}>
            <dt>{card.label}</dt>
            <dd className={styles.summaryValue}>{card.value}</dd>
            <dd className={styles.summaryDetail}>{card.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
