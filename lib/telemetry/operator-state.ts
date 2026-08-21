import type { MetricDto } from "@/lib/telemetry/contracts";
import {
  FRESHNESS_THRESHOLD_SECONDS,
  TELEMETRY_THRESHOLDS,
} from "@/lib/telemetry/config";

export type MeasurementSeverity = "normal" | "warning" | "critical";
export type TelemetryFreshness = "current" | "stale" | "no-data";
export type OperatorState =
  | "normal"
  | "warning"
  | "critical"
  | "stale"
  | "no-data";

export type TelemetryEvaluation = {
  state: OperatorState;
  freshness: TelemetryFreshness;
  measurementSeverity: MeasurementSeverity | null;
  powerSeverity: MeasurementSeverity | null;
  temperatureSeverity: MeasurementSeverity | null;
  reason: string;
};

const SEVERITY_RANK: Record<MeasurementSeverity, number> = {
  normal: 0,
  warning: 1,
  critical: 2,
};

export const OPERATOR_STATE_LABELS: Record<OperatorState, string> = {
  normal: "Normal",
  warning: "Warning",
  critical: "Critical",
  stale: "Stale",
  "no-data": "No Data",
};

export const FRESHNESS_LABELS: Record<TelemetryFreshness, string> = {
  current: "Current",
  stale: "Stale",
  "no-data": "No Data",
};

function classifyMeasurement(
  value: number,
  thresholds: { warning: number; critical: number },
): MeasurementSeverity {
  if (value >= thresholds.critical) {
    return "critical";
  }

  if (value >= thresholds.warning) {
    return "warning";
  }

  return "normal";
}

export function evaluatePower(value: number): MeasurementSeverity {
  return classifyMeasurement(value, TELEMETRY_THRESHOLDS.power);
}

export function evaluateTemperature(value: number): MeasurementSeverity {
  return classifyMeasurement(value, TELEMETRY_THRESHOLDS.temperature);
}

export function getHighestSeverity(
  powerSeverity: MeasurementSeverity,
  temperatureSeverity: MeasurementSeverity,
): MeasurementSeverity {
  return SEVERITY_RANK[powerSeverity] >= SEVERITY_RANK[temperatureSeverity]
    ? powerSeverity
    : temperatureSeverity;
}

export function evaluateFreshness(
  latestMetric: MetricDto | null,
  asOf: string | Date,
): TelemetryFreshness {
  if (latestMetric === null) {
    return "no-data";
  }

  const asOfMs = asOf instanceof Date ? asOf.getTime() : Date.parse(asOf);
  const recordedAtMs = Date.parse(latestMetric.recordedAt);
  const ageMs = asOfMs - recordedAtMs;

  return ageMs <= FRESHNESS_THRESHOLD_SECONDS * 1_000 ? "current" : "stale";
}

function thresholdReason(
  powerSeverity: MeasurementSeverity,
  temperatureSeverity: MeasurementSeverity,
): string {
  const powerExceeded = powerSeverity !== "normal";
  const temperatureExceeded = temperatureSeverity !== "normal";

  if (powerExceeded && temperatureExceeded) {
    return "Power and temperature above thresholds";
  }

  if (powerExceeded) {
    return `Power above ${powerSeverity} threshold`;
  }

  if (temperatureExceeded) {
    return `Temperature above ${temperatureSeverity} threshold`;
  }

  return "Power and temperature within demo thresholds";
}

export function evaluateTelemetry(
  latestMetric: MetricDto | null,
  asOf: string | Date,
): TelemetryEvaluation {
  const freshness = evaluateFreshness(latestMetric, asOf);

  if (latestMetric === null) {
    return {
      state: "no-data",
      freshness,
      measurementSeverity: null,
      powerSeverity: null,
      temperatureSeverity: null,
      reason: "No telemetry received",
    };
  }

  const powerSeverity = evaluatePower(latestMetric.power);
  const temperatureSeverity = evaluateTemperature(latestMetric.temperature);
  const measurementSeverity = getHighestSeverity(
    powerSeverity,
    temperatureSeverity,
  );

  if (freshness === "stale") {
    return {
      state: "stale",
      freshness,
      measurementSeverity,
      powerSeverity,
      temperatureSeverity,
      reason: `Telemetry older than ${FRESHNESS_THRESHOLD_SECONDS} seconds`,
    };
  }

  return {
    state: measurementSeverity,
    freshness,
    measurementSeverity,
    powerSeverity,
    temperatureSeverity,
    reason: thresholdReason(powerSeverity, temperatureSeverity),
  };
}
