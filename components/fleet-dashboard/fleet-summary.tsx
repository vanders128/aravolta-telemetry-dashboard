import type { FleetSummary as FleetSummaryValues } from "@/lib/telemetry/fleet-dashboard";
import { formatPower, formatTemperature } from "@/lib/telemetry/formatters";

import styles from "./telemetry-dashboard.module.css";

export function FleetSummary({ summary }: { summary: FleetSummaryValues }) {
  const cards = [
    {
      label: "Total devices",
      value: summary.totalDevices.toLocaleString("en-US"),
      detail: "Registered assets",
    },
    {
      label: "Devices with telemetry",
      value: summary.devicesWithTelemetry.toLocaleString("en-US"),
      detail: "Has a latest reading",
    },
    {
      label: "Current aggregate power",
      value:
        summary.aggregatePower === null
          ? "No data"
          : formatPower(summary.aggregatePower),
      detail: "Sum of latest readings",
    },
    {
      label: "Average current temperature",
      value:
        summary.averageTemperature === null
          ? "No data"
          : formatTemperature(summary.averageTemperature),
      detail: "Latest readings only",
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
