import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/server/db";

export type CreateMetricInput = {
  deviceId: string;
  power: number;
  temperature: number;
  recordedAt: Date;
};

const metricSelect = {
  id: true,
  deviceId: true,
  power: true,
  temperature: true,
  recordedAt: true,
  receivedAt: true,
} satisfies Prisma.MetricSelect;

export const metricRepository = {
  createMetric(input: CreateMetricInput) {
    return prisma.metric.create({
      data: input,
      select: metricSelect,
    });
  },

  findLatestByDeviceId(deviceId: string) {
    return prisma.metric.findFirst({
      where: { deviceId },
      orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
      select: metricSelect,
    });
  },

  findByDeviceIdAndRecordedAtRange(
    deviceId: string,
    from: Date,
    to: Date,
  ) {
    return prisma.metric.findMany({
      where: {
        deviceId,
        recordedAt: {
          gte: from,
          lte: to,
        },
      },
      orderBy: [{ recordedAt: "asc" }, { id: "asc" }],
      select: metricSelect,
    });
  },
};
