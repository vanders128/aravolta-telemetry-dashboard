import { z } from "zod";

export const DEFAULT_TELEMETRY_WINDOW_SECONDS = 60;
export const MAX_TELEMETRY_WINDOW_SECONDS = 3_600;

export const metricWindowQuerySchema = z.strictObject({
  windowSeconds: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_TELEMETRY_WINDOW_SECONDS)
    .default(DEFAULT_TELEMETRY_WINDOW_SECONDS),
});

export function createRecordedAtWindow(asOf: Date, windowSeconds: number) {
  const to = new Date(asOf.getTime());

  return {
    from: new Date(to.getTime() - windowSeconds * 1_000),
    to,
    windowSeconds,
  };
}
