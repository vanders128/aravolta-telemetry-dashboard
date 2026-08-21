import { beforeEach, describe, expect, it, vi } from "vitest";

import { deviceRepository } from "@/lib/server/repositories/device-repository";
import { metricRepository } from "@/lib/server/repositories/metric-repository";
import { ingestTelemetry } from "@/lib/server/services/telemetry-ingestion-service";

vi.mock("@/lib/server/repositories/device-repository", () => ({
  deviceRepository: {
    findById: vi.fn(),
  },
}));

vi.mock("@/lib/server/repositories/metric-repository", () => ({
  metricRepository: {
    createMetric: vi.fn(),
  },
}));

const findDeviceById = vi.mocked(deviceRepository.findById);
const createMetric = vi.mocked(metricRepository.createMetric);

const input = {
  deviceId: "rack-a1",
  power: 612,
  temperature: 77,
  recordedAt: new Date("2025-10-09T14:00:00Z"),
};

describe("ingestTelemetry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("persists telemetry for a known device and returns a JSON-safe DTO", async () => {
    const receivedAt = new Date("2025-10-09T14:00:00.250Z");
    findDeviceById.mockResolvedValue({
      id: "rack-a1",
      name: "Rack A1",
      location: "Data Hall A",
      createdAt: new Date("2025-01-01T00:00:00Z"),
    });
    createMetric.mockResolvedValue({
      id: BigInt("9007199254740993"),
      ...input,
      receivedAt,
    });

    await expect(ingestTelemetry(input)).resolves.toEqual({
      outcome: "created",
      metric: {
        id: "9007199254740993",
        deviceId: "rack-a1",
        power: 612,
        temperature: 77,
        recordedAt: "2025-10-09T14:00:00.000Z",
        receivedAt: "2025-10-09T14:00:00.250Z",
      },
    });
    expect(findDeviceById).toHaveBeenCalledWith("rack-a1");
    expect(createMetric).toHaveBeenCalledWith(input);
  });

  it("rejects an unknown device without attempting a write", async () => {
    findDeviceById.mockResolvedValue(null);

    await expect(ingestTelemetry(input)).resolves.toEqual({
      outcome: "device-not-found",
    });
    expect(createMetric).not.toHaveBeenCalled();
  });

  it("allows persistence failures to reach the HTTP boundary", async () => {
    findDeviceById.mockResolvedValue({
      id: "rack-a1",
      name: "Rack A1",
      location: "Data Hall A",
      createdAt: new Date("2025-01-01T00:00:00Z"),
    });
    createMetric.mockRejectedValue(new Error("database unavailable"));

    await expect(ingestTelemetry(input)).rejects.toThrow("database unavailable");
  });
});
