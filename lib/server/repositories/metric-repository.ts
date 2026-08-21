import { prisma } from "@/lib/server/db";

export type CreateMetricInput = {
  deviceId: string;
  power: number;
  temperature: number;
  recordedAt: Date;
};

export const metricRepository = {
  findDeviceById(deviceId: string) {
    return prisma.device.findUnique({
      where: { id: deviceId },
      select: { id: true },
    });
  },

  createMetric(input: CreateMetricInput) {
    return prisma.metric.create({
      data: input,
      select: {
        id: true,
        deviceId: true,
        power: true,
        temperature: true,
        recordedAt: true,
        receivedAt: true,
      },
    });
  },
};
