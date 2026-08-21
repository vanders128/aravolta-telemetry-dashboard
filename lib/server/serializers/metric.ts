export type MetricRecord = {
  id: bigint;
  deviceId: string;
  power: number;
  temperature: number;
  recordedAt: Date;
  receivedAt: Date;
};

export type MetricDto = {
  id: string;
  deviceId: string;
  power: number;
  temperature: number;
  recordedAt: string;
  receivedAt: string;
};

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
