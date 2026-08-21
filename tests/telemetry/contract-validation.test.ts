import { describe, expect, it } from "vitest";

import {
  isFleetDevicesResponse,
  isLiveDeviceSnapshotResponse,
} from "@/lib/telemetry/contract-validation";

function metric(deviceId = "rack-a1") {
  return {
    id: "9007199254740993",
    deviceId,
    power: 0,
    temperature: 0,
    recordedAt: "2025-10-09T13:59:55.000Z",
    receivedAt: "2025-10-09T13:59:56.000Z",
  };
}

function fleetResponse() {
  return {
    data: {
      devices: [
        {
          id: "rack-a1",
          name: "Rack A1",
          location: "Data Hall A",
          createdAt: "2025-01-01T00:00:00.000Z",
          latestMetric: metric(),
        },
      ],
    },
    meta: { asOf: "2025-10-09T14:00:00.000Z" },
  };
}

function liveResponse() {
  return {
    data: {
      device: {
        id: "rack-a1",
        name: "Rack A1",
        location: "Data Hall A",
      },
      latestMetric: metric(),
      metrics: [metric()],
    },
    meta: {
      asOf: "2025-10-09T14:00:00.000Z",
      windowSeconds: 60,
    },
  };
}

describe("telemetry response runtime validation", () => {
  it("accepts JSON-safe zero-valued fleet and live telemetry", () => {
    expect(isFleetDevicesResponse(fleetResponse())).toBe(true);
    expect(isLiveDeviceSnapshotResponse(liveResponse())).toBe(true);
  });

  it("rejects invalid dates and non-finite measurements", () => {
    const invalidDate = fleetResponse();
    invalidDate.data.devices[0]!.latestMetric!.recordedAt = "not-a-date";
    expect(isFleetDevicesResponse(invalidDate)).toBe(false);

    const invalidMeasurement = liveResponse();
    invalidMeasurement.data.metrics[0]!.power = Number.NaN;
    expect(isLiveDeviceSnapshotResponse(invalidMeasurement)).toBe(false);
  });

  it("rejects a fleet latest metric attributed to another device", () => {
    const payload = fleetResponse();
    payload.data.devices[0]!.latestMetric = metric("rack-b1");

    expect(isFleetDevicesResponse(payload)).toBe(false);
  });

  it("rejects live latest or history metrics attributed to another device", () => {
    const wrongLatest = liveResponse();
    wrongLatest.data.latestMetric = metric("rack-b1");
    expect(isLiveDeviceSnapshotResponse(wrongLatest)).toBe(false);

    const wrongHistory = liveResponse();
    wrongHistory.data.metrics = [metric("rack-b1")];
    expect(isLiveDeviceSnapshotResponse(wrongHistory)).toBe(false);
  });
});
