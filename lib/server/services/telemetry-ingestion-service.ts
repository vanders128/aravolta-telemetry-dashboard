import { deviceRepository } from "@/lib/server/repositories/device-repository";
import { metricRepository } from "@/lib/server/repositories/metric-repository";
import {
  serializeMetric,
  type MetricDto,
} from "@/lib/server/serializers/metric";
import type { TelemetryIngestionInput } from "@/lib/telemetry/ingestion-schema";

export type TelemetryIngestionResult =
  | { outcome: "created"; metric: MetricDto }
  | { outcome: "device-not-found" };

export async function ingestTelemetry(
  input: TelemetryIngestionInput,
): Promise<TelemetryIngestionResult> {
  const device = await deviceRepository.findById(input.deviceId);

  if (!device) {
    return { outcome: "device-not-found" };
  }

  const metric = await metricRepository.createMetric(input);

  return {
    outcome: "created",
    metric: serializeMetric(metric),
  };
}
