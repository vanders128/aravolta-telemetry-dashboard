import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/server/db";

const metricSelect = {
  id: true,
  deviceId: true,
  power: true,
  temperature: true,
  recordedAt: true,
  receivedAt: true,
} satisfies Prisma.MetricSelect;

export const deviceRepository = {
  findById(deviceId: string) {
    return prisma.device.findUnique({
      where: { id: deviceId },
      select: {
        id: true,
        name: true,
        location: true,
        createdAt: true,
      },
    });
  },

  findAllWithLatestMetric() {
    return prisma.device.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        location: true,
        createdAt: true,
        metrics: {
          take: 1,
          orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
          select: metricSelect,
        },
      },
    });
  },
};
