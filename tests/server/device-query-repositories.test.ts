import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/server/db";
import { deviceRepository } from "@/lib/server/repositories/device-repository";
import { metricRepository } from "@/lib/server/repositories/metric-repository";

vi.mock("@/lib/server/db", () => ({
  prisma: {
    device: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    metric: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe("device query repositories", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("selects one deterministically ordered latest metric per device", async () => {
    await deviceRepository.findAllWithLatestMetric();

    expect(prisma.device.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: expect.objectContaining({
          metrics: expect.objectContaining({
            take: 1,
            orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
          }),
        }),
      }),
    );
  });

  it("selects the latest metric by event time with an ID tie-breaker", async () => {
    await metricRepository.findLatestByDeviceId("rack-a1");

    expect(prisma.metric.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deviceId: "rack-a1" },
        orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
      }),
    );
  });

  it("queries an inclusive recordedAt range in chart order", async () => {
    const from = new Date("2025-10-09T13:59:00Z");
    const to = new Date("2025-10-09T14:00:00Z");

    await metricRepository.findByDeviceIdAndRecordedAtRange(
      "rack-a1",
      from,
      to,
    );

    expect(prisma.metric.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deviceId: "rack-a1",
          recordedAt: { gte: from, lte: to },
        },
        orderBy: [{ recordedAt: "asc" }, { id: "asc" }],
      }),
    );
  });
});
