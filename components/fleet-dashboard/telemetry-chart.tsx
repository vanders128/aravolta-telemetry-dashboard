"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { RollingTelemetryPoint } from "@/lib/telemetry/contracts";
import { TELEMETRY_DISPLAY_CONFIG } from "@/lib/telemetry/display-config";

import styles from "./telemetry-dashboard.module.css";

type MetricKind = "power" | "temperature";

const timeTickFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

const valueFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

const chartConfig = {
  power: {
    averageKey: "powerRollingAverage" as const,
    rawKey: "power" as const,
    ...TELEMETRY_DISPLAY_CONFIG.power,
  },
  temperature: {
    averageKey: "temperatureRollingAverage" as const,
    rawKey: "temperature" as const,
    ...TELEMETRY_DISPLAY_CONFIG.temperature,
  },
};

function formatTime(value: number): string {
  return Number.isFinite(value)
    ? timeTickFormatter.format(new Date(value))
    : "Unavailable";
}

export function TelemetryChart({
  metric,
  points,
  windowStartMs,
  windowEndMs,
}: {
  metric: MetricKind;
  points: RollingTelemetryPoint[];
  windowStartMs: number;
  windowEndMs: number;
}) {
  const config = chartConfig[metric];
  const latestPoint = points.at(-1);
  const rawValue = latestPoint?.[config.rawKey];
  const averageValue = latestPoint?.[config.averageKey];
  const titleId = `${metric}-telemetry-title`;
  const description = `${config.label} telemetry over the last 60 seconds, showing raw readings and a 10-second rolling average.`;

  return (
    <section className={styles.chartCard} aria-labelledby={titleId}>
      <div className={styles.chartHeader}>
        <div>
          <h3 id={titleId}>{config.label}</h3>
          <p>{config.unitName}</p>
        </div>
        <dl className={styles.chartReadouts}>
          <div>
            <dt>Latest raw</dt>
            <dd>
              {rawValue === undefined
                ? "—"
                : `${valueFormatter.format(rawValue)} ${config.unitSymbol}`}
            </dd>
          </div>
          <div>
            <dt>10s average</dt>
            <dd>
              {averageValue === undefined
                ? "—"
                : `${valueFormatter.format(averageValue)} ${config.unitSymbol}`}
            </dd>
          </div>
        </dl>
      </div>

      <div className={styles.chartCanvas}>
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          minHeight={190}
          initialDimension={{ width: 640, height: 210 }}
        >
          <LineChart
            data={points}
            margin={{ top: 8, right: 12, bottom: 2, left: 0 }}
            accessibilityLayer
            title={`${config.label} telemetry chart`}
            desc={description}
          >
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="timestampMs"
              type="number"
              scale="time"
              domain={[windowStartMs, windowEndMs]}
              allowDataOverflow
              minTickGap={28}
              tickFormatter={(value) => formatTime(Number(value))}
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border-default)" }}
            />
            <YAxis
              width={46}
              tickFormatter={(value) => valueFormatter.format(Number(value))}
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              animationDuration={0}
              labelFormatter={(value) => formatTime(Number(value))}
              formatter={(value, name) => [
                `${valueFormatter.format(Number(value))} ${config.unitSymbol}`,
                name,
              ]}
              contentStyle={{
                background: "var(--surface-raised)",
                border: "1px solid var(--border-default)",
                borderRadius: "0.375rem",
                color: "var(--text-primary)",
                fontSize: "0.75rem",
              }}
              labelStyle={{ color: "var(--text-secondary)" }}
            />
            <Legend
              iconType="plainline"
              iconSize={16}
              wrapperStyle={{ fontSize: "0.72rem", paddingTop: "0.35rem" }}
            />
            <Line
              dataKey={config.rawKey}
              name="Raw"
              type="linear"
              stroke="var(--chart-raw)"
              strokeWidth={1.5}
              dot={points.length === 1 ? { r: 2.5 } : false}
              activeDot={{ r: 3 }}
              isAnimationActive={false}
            />
            <Line
              dataKey={config.averageKey}
              name="10s average"
              type="linear"
              stroke="var(--chart-average)"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
              activeDot={{ r: 3 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
