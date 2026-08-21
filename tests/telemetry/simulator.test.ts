import { describe, expect, it } from "vitest";

import {
  DEMO_DEVICES,
  NO_DATA_DEMO_DEVICE_ID,
  SIMULATED_DEMO_DEVICES,
  STALE_DEMO_DEVICE_ID,
} from "@/lib/telemetry/demo-fleet";
import {
  advanceSimulatorReadings,
  createInitialSimulatorReadings,
} from "@/lib/telemetry/simulator";

describe("deterministic demo fleet", () => {
  it("defines 12 unique known devices and preserves no-data/stale exclusions", () => {
    expect(DEMO_DEVICES).toHaveLength(12);
    expect(new Set(DEMO_DEVICES.map((device) => device.id)).size).toBe(12);
    expect(SIMULATED_DEMO_DEVICES).toHaveLength(10);
    expect(SIMULATED_DEMO_DEVICES.some((device) => device.id === NO_DATA_DEMO_DEVICE_ID)).toBe(false);
    expect(SIMULATED_DEMO_DEVICES.some((device) => device.id === STALE_DEMO_DEVICE_ID)).toBe(false);
    expect(DEMO_DEVICES.find((device) => device.id === NO_DATA_DEMO_DEVICE_ID)?.seedTelemetry).toBeNull();
    expect(DEMO_DEVICES.find((device) => device.id === STALE_DEMO_DEVICE_ID)?.seedTelemetry?.latestAgeSeconds).toBeGreaterThan(45);
  });

  it("advances reproducibly with gradual values bounded by each profile", () => {
    const initial = createInitialSimulatorReadings();
    const first = advanceSimulatorReadings(initial, 0);
    expect(first).toEqual(advanceSimulatorReadings(initial, 0));

    for (const reading of first) {
      const device = SIMULATED_DEMO_DEVICES.find((candidate) => candidate.id === reading.deviceId);
      expect(device).toBeDefined();
      expect(reading.power).toBeGreaterThanOrEqual(device!.simulatorProfile.power.min);
      expect(reading.power).toBeLessThanOrEqual(device!.simulatorProfile.power.max);
      expect(reading.temperature).toBeGreaterThanOrEqual(device!.simulatorProfile.temperature.min);
      expect(reading.temperature).toBeLessThanOrEqual(device!.simulatorProfile.temperature.max);
    }
  });

  it("keeps warning and critical profiles inside reproducible state bands", () => {
    let readings = createInitialSimulatorReadings();
    for (let tick = 0; tick < 40; tick += 1) {
      readings = advanceSimulatorReadings(readings, tick);
    }

    const warning = readings.find((reading) => reading.deviceId === "ups-01");
    const critical = readings.find((reading) => reading.deviceId === "rack-b2");
    expect(warning?.power).toBeGreaterThanOrEqual(1_050);
    expect(warning?.power).toBeLessThanOrEqual(1_150);
    expect(warning?.temperature).toBeGreaterThanOrEqual(86);
    expect(critical?.power).toBeGreaterThanOrEqual(1_260);
    expect(critical?.temperature).toBeGreaterThanOrEqual(96);
  });
});
