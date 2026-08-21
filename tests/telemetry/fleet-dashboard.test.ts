import { describe, expect, it } from "vitest";

import type { FleetDeviceDto, MetricDto } from "@/lib/telemetry/contracts";
import {
  ALL_LOCATIONS,
  ALL_STATUSES,
  UNASSIGNED_LOCATION,
  calculateFleetSummary,
  filterFleetDevices,
  getLocationOptions,
} from "@/lib/telemetry/fleet-dashboard";

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

function device(
  id: string,
  overrides: Partial<FleetDeviceDto> = {},
): FleetDeviceDto {
  return {
    id,
    name: `Device ${id}`,
    location: "Data Hall A",
    createdAt: "2025-01-01T00:00:00.000Z",
    latestMetric: metric({ deviceId: id }),
    ...overrides,
  };
}

describe("fleet dashboard derivations", () => {
  it("summarizes operator states and preserves legitimate zero readings", () => {
    const devices = [
      device("rack-a1"),
      device("rack-b1", {
        latestMetric: metric({
          id: "102",
          deviceId: "rack-b1",
          power: 0,
          temperature: 0,
        }),
      }),
      device("rack-c1", { latestMetric: null }),
    ];

    expect(calculateFleetSummary(devices, AS_OF)).toEqual({
      totalDevices: 3,
      normalCurrent: 2,
      needsAttention: 0,
      staleOrNoData: 1,
      currentAggregatePower: 600,
    });
  });

  it("uses null rather than a misleading zero when no current telemetry exists", () => {
    const summary = calculateFleetSummary(
      [
        device("rack-a1", { latestMetric: null }),
        device("rack-b1", {
          latestMetric: metric({
            deviceId: "rack-b1",
            recordedAt: "2025-10-09T13:59:00.000Z",
          }),
        }),
      ],
      AS_OF,
    );

    expect(summary).toEqual({
      totalDevices: 2,
      normalCurrent: 0,
      needsAttention: 0,
      staleOrNoData: 2,
      currentAggregatePower: null,
    });
  });

  it.each([
    ["  ALPHA ", "rack-a1"],
    ["RACK-B1", "rack-b1"],
    ["south", "rack-b1"],
  ])("matches trimmed search %s against name, ID, or location", (query, id) => {
    const devices = [
      device("rack-a1", { name: "Alpha rack", location: "North plant" }),
      device("rack-b1", { name: "Beta rack", location: "South plant" }),
    ];

    expect(filterFleetDevices(devices, query, ALL_LOCATIONS)).toEqual([
      expect.objectContaining({ id }),
    ]);
  });

  it("derives location options and combines location filtering with search", () => {
    const devices = [
      device("rack-a1", { name: "Alpha", location: "Data Hall B" }),
      device("rack-a2", { name: "Archive", location: "Data Hall B" }),
      device("rack-b1", { name: "Alpha", location: "Data Hall A" }),
      device("rack-c1", { location: null }),
    ];

    expect(getLocationOptions(devices)).toEqual([
      { label: "All locations", value: ALL_LOCATIONS },
      { label: "Data Hall A", value: "location:Data Hall A" },
      { label: "Data Hall B", value: "location:Data Hall B" },
      { label: "Unassigned", value: UNASSIGNED_LOCATION },
    ]);
    expect(
      filterFleetDevices(devices, "alpha", "location:Data Hall B"),
    ).toEqual([expect.objectContaining({ id: "rack-a1" })]);
    expect(filterFleetDevices(devices, "", UNASSIGNED_LOCATION)).toEqual([
      expect.objectContaining({ id: "rack-c1" }),
    ]);
  });

  it("calculates attention counts and excludes stale power from aggregate", () => {
    const devices = [
      device("normal"),
      device("warning", {
        latestMetric: metric({ deviceId: "warning", power: 1_000 }),
      }),
      device("critical", {
        latestMetric: metric({ deviceId: "critical", temperature: 95 }),
      }),
      device("stale", {
        latestMetric: metric({
          deviceId: "stale",
          power: 1_300,
          recordedAt: "2025-10-09T13:59:00.000Z",
        }),
      }),
      device("no-data", { latestMetric: null }),
    ];

    expect(calculateFleetSummary(devices, AS_OF)).toEqual({
      totalDevices: 5,
      normalCurrent: 1,
      needsAttention: 2,
      staleOrNoData: 2,
      currentAggregatePower: 2_200,
    });
  });

  it.each(["normal", "warning", "critical", "stale", "no-data"] as const)(
    "filters status %s",
    (status) => {
      const devices = [
        device("normal"),
        device("warning", {
          latestMetric: metric({ deviceId: "warning", power: 1_000 }),
        }),
        device("critical", {
          latestMetric: metric({ deviceId: "critical", temperature: 95 }),
        }),
        device("stale", {
          latestMetric: metric({
            deviceId: "stale",
            recordedAt: "2025-10-09T13:59:00.000Z",
          }),
        }),
        device("no-data", { latestMetric: null }),
      ];

      expect(
        filterFleetDevices(devices, "", ALL_LOCATIONS, status, AS_OF),
      ).toEqual([expect.objectContaining({ id: status })]);
    },
  );

  it("combines search, location, and status filters with AND semantics", () => {
    const devices = [
      device("north-warning", {
        name: "Alpha UPS",
        location: "North plant",
        latestMetric: metric({ deviceId: "north-warning", power: 1_000 }),
      }),
      device("south-warning", {
        name: "Alpha UPS",
        location: "South plant",
        latestMetric: metric({ deviceId: "south-warning", power: 1_000 }),
      }),
      device("north-normal", {
        name: "Alpha rack",
        location: "North plant",
      }),
    ];

    expect(
      filterFleetDevices(
        devices,
        "alpha",
        "location:North plant",
        "warning",
        AS_OF,
      ),
    ).toEqual([expect.objectContaining({ id: "north-warning" })]);
    expect(
      filterFleetDevices(
        devices,
        "alpha",
        ALL_LOCATIONS,
        ALL_STATUSES,
        AS_OF,
      ),
    ).toHaveLength(3);
  });
});
