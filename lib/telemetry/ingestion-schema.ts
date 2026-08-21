import { z } from "zod";

export const telemetryIngestionSchema = z
  .strictObject({
    deviceId: z.string().trim().min(1).max(64),
    power: z.number().finite(),
    temperature: z.number().finite(),
    timestamp: z.iso.datetime({ offset: true }),
  })
  .transform(({ timestamp, ...telemetry }) => ({
    ...telemetry,
    recordedAt: new Date(timestamp),
  }));

export type TelemetryIngestionInput = z.output<
  typeof telemetryIngestionSchema
>;
