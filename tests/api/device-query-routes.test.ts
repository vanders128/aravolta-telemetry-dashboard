import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getDeviceLive } from "@/app/api/devices/[id]/live/route";
import { GET as getDeviceMetrics } from "@/app/api/devices/[id]/metrics/route";
import { GET as getDevices } from "@/app/api/devices/route";
import {
  getLiveDeviceSnapshot,
  getRecentDeviceMetrics,
  listDevices,
} from "@/lib/server/services/device-query-service";

vi.mock("@/lib/server/services/device-query-service", () => ({
  getLiveDeviceSnapshot: vi.fn(),
  getRecentDeviceMetrics: vi.fn(),
  listDevices: vi.fn(),
}));

const getLiveDeviceSnapshotMock = vi.mocked(getLiveDeviceSnapshot);
const getRecentDeviceMetricsMock = vi.mocked(getRecentDeviceMetrics);
const listDevicesMock = vi.mocked(listDevices);

const device = {
  id: "rack-a1",
  name: "Rack A1",
  location: "Data Hall A",
};
const metric = {
  id: "101",
  deviceId: "rack-a1",
  power: 612,
  temperature: 77,
  recordedAt: "2025-10-09T13:59:55.000Z",
  receivedAt: "2025-10-09T13:59:56.000Z",
};

function context(id = "rack-a1") {
  return { params: Promise.resolve({ id }) };
}

function metricsRequest(query = "") {
  return new Request(`http://localhost/api/devices/rack-a1/metrics${query}`);
}

describe("device query routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the fleet response with no-store", async () => {
    listDevicesMock.mockResolvedValue({
      devices: [
        {
          ...device,
          createdAt: "2025-01-01T00:00:00.000Z",
          latestMetric: metric,
        },
      ],
      asOf: "2025-10-09T14:00:00.000Z",
    });

    const response = await getDevices();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      data: {
        devices: [
          {
            ...device,
            createdAt: "2025-01-01T00:00:00.000Z",
            latestMetric: metric,
          },
        ],
      },
      meta: { asOf: "2025-10-09T14:00:00.000Z" },
    });
  });

  it("returns a sanitized no-store fleet error", async () => {
    const error = new Error("database unavailable");
    vi.spyOn(console, "error").mockImplementation(() => {});
    listDevicesMock.mockRejectedValue(error);

    const response = await getDevices();

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unable to retrieve devices.",
      },
    });
  });

  it("uses the default metrics window and returns no-store", async () => {
    getRecentDeviceMetricsMock.mockResolvedValue({
      outcome: "found",
      data: { device, metrics: [metric] },
      meta: {
        from: "2025-10-09T13:59:00.000Z",
        to: "2025-10-09T14:00:00.000Z",
        windowSeconds: 60,
      },
    });

    const response = await getDeviceMetrics(metricsRequest(), context());

    expect(getRecentDeviceMetricsMock).toHaveBeenCalledWith("rack-a1", 60);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      data: { device, metrics: [metric] },
      meta: { windowSeconds: 60 },
    });
  });

  it("accepts a custom metrics window", async () => {
    getRecentDeviceMetricsMock.mockResolvedValue({
      outcome: "found",
      data: { device, metrics: [] },
      meta: {
        from: "2025-10-09T13:58:00.000Z",
        to: "2025-10-09T14:00:00.000Z",
        windowSeconds: 120,
      },
    });

    const response = await getDeviceMetrics(
      metricsRequest("?windowSeconds=120"),
      context(),
    );

    expect(response.status).toBe(200);
    expect(getRecentDeviceMetricsMock).toHaveBeenCalledWith("rack-a1", 120);
  });

  it.each(["0", "1.5", "3601", "not-a-number", ""])(
    "rejects invalid windowSeconds=%s",
    async (windowSeconds) => {
      const response = await getDeviceMetrics(
        metricsRequest(`?windowSeconds=${windowSeconds}`),
        context(),
      );

      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("no-store");
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "INVALID_QUERY",
          message: "windowSeconds must be an integer between 1 and 3600.",
        },
      });
      expect(getRecentDeviceMetricsMock).not.toHaveBeenCalled();
    },
  );

  it("returns 404 for metrics from an unknown device", async () => {
    getRecentDeviceMetricsMock.mockResolvedValue({
      outcome: "device-not-found",
    });

    const response = await getDeviceMetrics(metricsRequest(), context("missing"));

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "DEVICE_NOT_FOUND" },
    });
  });

  it("returns a sanitized no-store metrics error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getRecentDeviceMetricsMock.mockRejectedValue(new Error("database unavailable"));

    const response = await getDeviceMetrics(metricsRequest(), context());

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INTERNAL_SERVER_ERROR" },
    });
  });

  it("returns a complete live snapshot with no-store", async () => {
    const earlierMetric = {
      ...metric,
      id: "100",
      recordedAt: "2025-10-09T13:59:15.000Z",
    };
    getLiveDeviceSnapshotMock.mockResolvedValue({
      outcome: "found",
      data: {
        device,
        latestMetric: metric,
        metrics: [earlierMetric, metric],
      },
      meta: {
        asOf: "2025-10-09T14:00:00.000Z",
        windowSeconds: 60,
      },
    });

    const response = await getDeviceLive(
      new Request("http://localhost/api/devices/rack-a1/live"),
      context(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      data: {
        latestMetric: { id: "101" },
        metrics: [{ id: "100" }, { id: "101" }],
      },
      meta: { windowSeconds: 60 },
    });
  });

  it("returns 404 for a live snapshot of an unknown device", async () => {
    getLiveDeviceSnapshotMock.mockResolvedValue({
      outcome: "device-not-found",
    });

    const response = await getDeviceLive(
      new Request("http://localhost/api/devices/missing/live"),
      context("missing"),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "DEVICE_NOT_FOUND" },
    });
  });

  it("returns a sanitized no-store live error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getLiveDeviceSnapshotMock.mockRejectedValue(
      new Error("database unavailable"),
    );

    const response = await getDeviceLive(
      new Request("http://localhost/api/devices/rack-a1/live"),
      context(),
    );

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INTERNAL_SERVER_ERROR" },
    });
  });
});
