import { describe, expect, it } from "vitest";

import type { MetricDto } from "@/lib/telemetry/contracts";
import {
  evaluateFreshness,
  evaluatePower,
  evaluateTelemetry,
  evaluateTemperature,
  getHighestSeverity,
} from "@/lib/telemetry/operator-state";

const AS_OF = "2025-10-09T14:00:00.000Z";

function metric(overrides: Partial<MetricDto> = {}): MetricDto {
  return {
    id: "101",
    deviceId: "rack-a1",
    power: 600,
    temperature: 80,
    recordedAt: "2025-10-09T13:59:55.000Z",
    receivedAt: "2025-10-09T13:59:56.000Z",
    ...overrides,
  };
}

describe("measurement severity", () => {
  it.each([
    [84.9, "normal"],
    [85, "warning"],
    [94.9, "warning"],
    [95, "critical"],
  ] as const)("classifies temperature %s as %s", (value, expected) => {
    expect(evaluateTemperature(value)).toBe(expected);
  });

  it.each([
    [999.9, "normal"],
    [1_000, "warning"],
    [1_249.9, "warning"],
    [1_250, "critical"],
  ] as const)("classifies power %s as %s", (value, expected) => {
    expect(evaluatePower(value)).toBe(expected);
  });

  it("uses the highest power or temperature severity", () => {
    expect(getHighestSeverity("warning", "normal")).toBe("warning");
    expect(getHighestSeverity("warning", "critical")).toBe("critical");
  });

  it.each([
    [{ power: 1_000, temperature: 80 }, "Power above warning threshold"],
    [{ power: 600, temperature: 95 }, "Temperature above critical threshold"],
    [{ power: 1_250, temperature: 85 }, "Power and temperature above thresholds"],
  ])("generates a deterministic reason for %o", (values, reason) => {
    expect(evaluateTelemetry(metric(values), AS_OF).reason).toBe(reason);
  });
});

describe("freshness and final operator state", () => {
  it("returns no-data when no latest metric exists", () => {
    expect(evaluateFreshness(null, AS_OF)).toBe("no-data");
    expect(evaluateTelemetry(null, AS_OF)).toMatchObject({
      state: "no-data",
      reason: "No telemetry received",
    });
  });

  it.each([
    ["2025-10-09T13:59:15.000Z", "current"],
    ["2025-10-09T13:59:15.001Z", "current"],
    ["2025-10-09T13:59:14.999Z", "stale"],
  ] as const)("classifies %s as %s", (recordedAt, freshness) => {
    expect(evaluateFreshness(metric({ recordedAt }), AS_OF)).toBe(freshness);
  });

  it("lets stale freshness dominate otherwise normal severity", () => {
    expect(
      evaluateTelemetry(
        metric({ recordedAt: "2025-10-09T13:59:00.000Z" }),
        AS_OF,
      ),
    ).toMatchObject({ state: "stale", measurementSeverity: "normal" });
  });

  it("lets stale freshness dominate warning and critical measurements", () => {
    expect(
      evaluateTelemetry(
        metric({
          power: 1_300,
          temperature: 90,
          recordedAt: "2025-10-09T13:59:00.000Z",
        }),
        AS_OF,
      ),
    ).toMatchObject({
      state: "stale",
      measurementSeverity: "critical",
      reason: "Telemetry older than 45 seconds",
    });
  });

  it.each([
    [null, "no-data"],
    [metric({ recordedAt: "2025-10-09T13:59:00.000Z" }), "stale"],
    [metric({ temperature: 95 }), "critical"],
    [metric({ power: 1_000 }), "warning"],
    [metric(), "normal"],
  ] as const)("produces final state %s", (latestMetric, expected) => {
    expect(evaluateTelemetry(latestMetric, AS_OF).state).toBe(expected);
  });
});
