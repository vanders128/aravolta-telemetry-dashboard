import { describe, expect, it } from "vitest";

import type { LiveTelemetryPoint, MetricDto } from "@/lib/telemetry/contracts";
import {
  calculateRollingTelemetry,
  metricToLiveTelemetryPoint,
  prepareLiveTelemetryPoints,
} from "@/lib/telemetry/live-telemetry";

function metric(
  id: string,
  recordedAt: string,
  power: number,
  temperature: number,
): MetricDto {
  return {
    id,
    deviceId: "rack-a1",
    power,
    temperature,
    recordedAt,
    receivedAt: "2025-10-09T14:00:01.000Z",
  };
}

function point(
  timestamp: string,
  power: number,
  temperature: number,
): LiveTelemetryPoint {
  return { timestamp, power, temperature };
}

describe("live telemetry presentation", () => {
  it("explicitly maps recordedAt to timestamp and preserves measurements", () => {
    expect(
      metricToLiveTelemetryPoint(
        metric("1", "2025-10-09T13:59:55.000Z", 612, 77),
      ),
    ).toEqual({
      power: 612,
      temperature: 77,
      timestamp: "2025-10-09T13:59:55.000Z",
    });
  });

  it("keeps only the inclusive 60-second event-time window", () => {
    const metrics = [
      metric("old", "2025-10-09T13:58:59.999Z", 1, 1),
      metric("boundary", "2025-10-09T13:59:00.000Z", 2, 2),
      metric("latest", "2025-10-09T14:00:00.000Z", 3, 3),
      metric("future", "2025-10-09T14:00:00.001Z", 4, 4),
    ];

    expect(
      prepareLiveTelemetryPoints(
        metrics,
        "2025-10-09T14:00:00.000Z",
      ).map(({ power }) => power),
    ).toEqual([2, 3]);
  });

  it("sorts chronologically while preserving API order for equal timestamps", () => {
    const metrics = [
      metric("later", "2025-10-09T13:59:55.000Z", 30, 80),
      metric("equal-a", "2025-10-09T13:59:50.000Z", 10, 70),
      metric("equal-b", "2025-10-09T13:59:50.000Z", 20, 75),
    ];

    expect(
      prepareLiveTelemetryPoints(
        metrics,
        "2025-10-09T14:00:00.000Z",
      ).map(({ power }) => power),
    ).toEqual([10, 20, 30]);
  });

  it("returns no chart points for an empty snapshot", () => {
    expect(
      prepareLiveTelemetryPoints([], "2025-10-09T14:00:00.000Z"),
    ).toEqual([]);
  });

  it("uses an inclusive, time-based 10-second rolling window", () => {
    const result = calculateRollingTelemetry([
      point("2025-10-09T13:59:49.999Z", 10, 60),
      point("2025-10-09T13:59:50.000Z", 20, 70),
      point("2025-10-09T13:59:56.000Z", 40, 80),
      point("2025-10-09T14:00:00.000Z", 60, 90),
    ]);
    const latest = result.at(-1);

    expect(latest?.powerRollingAverage).toBe(40);
    expect(latest?.temperatureRollingAverage).toBe(80);
  });

  it("handles irregular intervals and averages power and temperature separately", () => {
    const result = calculateRollingTelemetry([
      point("2025-10-09T13:59:59.900Z", 600, 90),
      point("2025-10-09T13:59:51.000Z", 100, 60),
      point("2025-10-09T13:59:56.500Z", 200, 75),
    ]);
    const latest = result.at(-1);

    expect(result.map((sample) => sample.power)).toEqual([100, 200, 600]);
    expect(latest?.powerRollingAverage).toBe(300);
    expect(latest?.temperatureRollingAverage).toBe(75);
  });

  it("includes the complete equal-timestamp group deterministically", () => {
    const result = calculateRollingTelemetry([
      point("2025-10-09T13:59:55.000Z", 100, 60),
      point("2025-10-09T13:59:55.000Z", 300, 80),
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]?.power).toBe(100);
    expect(result[1]?.power).toBe(300);
    expect(result[0]?.powerRollingAverage).toBe(200);
    expect(result[1]?.powerRollingAverage).toBe(200);
    expect(result[0]?.temperatureRollingAverage).toBe(70);
    expect(result[1]?.temperatureRollingAverage).toBe(70);
  });

  it("preserves legitimate zero readings", () => {
    const [result] = calculateRollingTelemetry([
      point("2025-10-09T13:59:55.000Z", 0, 0),
    ]);

    expect(result).toMatchObject({
      power: 0,
      temperature: 0,
      powerRollingAverage: 0,
      temperatureRollingAverage: 0,
    });
  });
});
