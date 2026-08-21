import { metricRepository } from "@/lib/server/repositories/metric-repository";
import type { TelemetryIngestionInput } from "@/lib/telemetry/ingestion-schema";

type IngestedMetric = {
  id: string;
  deviceId: string;
  power: number;
  temperature: number;
  recordedAt: string;
  receivedAt: string;
};

export type TelemetryIngestionResult =
  | { outcome: "created"; metric: IngestedMetric }
  | { outcome: "device-not-found" };

export async function ingestTelemetry(
  input: TelemetryIngestionInput,
): Promise<TelemetryIngestionResult> {
  const device = await metricRepository.findDeviceById(input.deviceId);

  if (!device) {
    return { outcome: "device-not-found" };
  }

  const metric = await metricRepository.createMetric(input);

  return {
    outcome: "created",
    metric: {
      id: metric.id.toString(),
      deviceId: metric.deviceId,
      power: metric.power,
      temperature: metric.temperature,
      recordedAt: metric.recordedAt.toISOString(),
      receivedAt: metric.receivedAt.toISOString(),
    },
  };
}
