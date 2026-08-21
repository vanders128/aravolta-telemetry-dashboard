import type { MetricDto } from "@/lib/telemetry/contracts";

export type MetricRecord = {
  id: bigint;
  deviceId: string;
  power: number;
  temperature: number;
  recordedAt: Date;
  receivedAt: Date;
};

export type { MetricDto } from "@/lib/telemetry/contracts";

export function serializeMetric(metric: MetricRecord): MetricDto {
  return {
    id: metric.id.toString(),
    deviceId: metric.deviceId,
    power: metric.power,
    temperature: metric.temperature,
    recordedAt: metric.recordedAt.toISOString(),
    receivedAt: metric.receivedAt.toISOString(),
  };
}
