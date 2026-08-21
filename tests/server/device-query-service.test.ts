import { beforeEach, describe, expect, it, vi } from "vitest";

import { deviceRepository } from "@/lib/server/repositories/device-repository";
import { metricRepository } from "@/lib/server/repositories/metric-repository";
import {
  getLiveDeviceSnapshot,
  getRecentDeviceMetrics,
  listDevices,
} from "@/lib/server/services/device-query-service";

vi.mock("@/lib/server/repositories/device-repository", () => ({
  deviceRepository: {
    findById: vi.fn(),
    findAllWithLatestMetric: vi.fn(),
  },
}));

vi.mock("@/lib/server/repositories/metric-repository", () => ({
  metricRepository: {
    findLatestByDeviceId: vi.fn(),
    findByDeviceIdAndRecordedAtRange: vi.fn(),
  },
}));

const findById = vi.mocked(deviceRepository.findById);
const findAllWithLatestMetric = vi.mocked(
  deviceRepository.findAllWithLatestMetric,
);
const findLatestByDeviceId = vi.mocked(
  metricRepository.findLatestByDeviceId,
);
const findByRecordedAtRange = vi.mocked(
  metricRepository.findByDeviceIdAndRecordedAtRange,
);

const asOf = new Date("2025-10-09T14:00:00Z");
const device = {
  id: "rack-a1",
  name: "Rack A1",
  location: "Data Hall A",
  createdAt: new Date("2025-01-01T00:00:00Z"),
};

function metric(id: string, recordedAt: string) {
  return {
    id: BigInt(id),
    deviceId: "rack-a1",
    power: 612,
    temperature: 77,
    recordedAt: new Date(recordedAt),
    receivedAt: new Date("2025-10-09T14:00:01Z"),
  };
}

describe("device query service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("serializes fleet devices with their latest metric or null", async () => {
    findAllWithLatestMetric.mockResolvedValue([
      {
        ...device,
        metrics: [metric("9007199254740993", "2025-10-09T13:59:55Z")],
      },
      {
        id: "rack-c1",
        name: "Rack C1",
        location: "Data Hall C",
        createdAt: new Date("2025-01-01T00:00:00Z"),
        metrics: [],
      },
    ]);

    await expect(listDevices(asOf)).resolves.toEqual({
      devices: [
        {
          id: "rack-a1",
          name: "Rack A1",
          location: "Data Hall A",
          createdAt: "2025-01-01T00:00:00.000Z",
          latestMetric: {
            id: "9007199254740993",
            deviceId: "rack-a1",
            power: 612,
            temperature: 77,
            recordedAt: "2025-10-09T13:59:55.000Z",
            receivedAt: "2025-10-09T14:00:01.000Z",
          },
        },
        {
          id: "rack-c1",
          name: "Rack C1",
          location: "Data Hall C",
          createdAt: "2025-01-01T00:00:00.000Z",
          latestMetric: null,
        },
      ],
      asOf: "2025-10-09T14:00:00.000Z",
    });
  });

  it("calculates and returns a configurable recordedAt window", async () => {
    const readings = [
      metric("10", "2025-10-09T13:58:30Z"),
      metric("11", "2025-10-09T13:59:30Z"),
    ];
    findById.mockResolvedValue(device);
    findByRecordedAtRange.mockResolvedValue(readings);

    const result = await getRecentDeviceMetrics("rack-a1", 120, asOf);

    expect(findByRecordedAtRange).toHaveBeenCalledWith(
      "rack-a1",
      new Date("2025-10-09T13:58:00Z"),
      asOf,
    );
    expect(result).toMatchObject({
      outcome: "found",
      data: {
        device: {
          id: "rack-a1",
          name: "Rack A1",
          location: "Data Hall A",
        },
        metrics: [{ id: "10" }, { id: "11" }],
      },
      meta: {
        from: "2025-10-09T13:58:00.000Z",
        to: "2025-10-09T14:00:00.000Z",
        windowSeconds: 120,
      },
    });
  });

  it("returns an empty metric array for a known device with no telemetry", async () => {
    findById.mockResolvedValue(device);
    findByRecordedAtRange.mockResolvedValue([]);

    const result = await getRecentDeviceMetrics("rack-a1", 60, asOf);

    expect(result).toMatchObject({
      outcome: "found",
      data: { metrics: [] },
    });
  });

  it("does not query metrics when the device is unknown", async () => {
    findById.mockResolvedValue(null);

    await expect(
      getRecentDeviceMetrics("missing", 60, asOf),
    ).resolves.toEqual({ outcome: "device-not-found" });
    expect(findByRecordedAtRange).not.toHaveBeenCalled();
  });

  it("returns an all-time latest metric and the complete live window", async () => {
    const latest = metric("13", "2025-10-09T13:59:55Z");
    const readings = [
      metric("11", "2025-10-09T13:59:15Z"),
      latest,
    ];
    findById.mockResolvedValue(device);
    findLatestByDeviceId.mockResolvedValue(latest);
    findByRecordedAtRange.mockResolvedValue(readings);

    const result = await getLiveDeviceSnapshot("rack-a1", asOf);

    expect(findByRecordedAtRange).toHaveBeenCalledWith(
      "rack-a1",
      new Date("2025-10-09T13:59:00Z"),
      asOf,
    );
    expect(result).toMatchObject({
      outcome: "found",
      data: {
        latestMetric: { id: "13" },
        metrics: [{ id: "11" }, { id: "13" }],
      },
      meta: {
        asOf: "2025-10-09T14:00:00.000Z",
        windowSeconds: 60,
      },
    });
  });
});
