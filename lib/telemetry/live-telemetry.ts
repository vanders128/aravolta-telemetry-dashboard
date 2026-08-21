import type {
  LiveTelemetryPoint,
  MetricDto,
  RollingTelemetryPoint,
} from "@/lib/telemetry/contracts";

export const LIVE_TELEMETRY_POLL_INTERVAL_MS = 15_000;
export const LIVE_TELEMETRY_WINDOW_SECONDS = 60;
export const ROLLING_AVERAGE_WINDOW_SECONDS = 10;

export function metricToLiveTelemetryPoint(
  metric: MetricDto,
): LiveTelemetryPoint {
  return {
    power: metric.power,
    temperature: metric.temperature,
    timestamp: metric.recordedAt,
  };
}

export function prepareLiveTelemetryPoints(
  metrics: MetricDto[],
  asOf: string,
  windowSeconds = LIVE_TELEMETRY_WINDOW_SECONDS,
): LiveTelemetryPoint[] {
  const asOfMs = Date.parse(asOf);

  if (!Number.isFinite(asOfMs) || windowSeconds <= 0) {
    return [];
  }

  const windowStartMs = asOfMs - windowSeconds * 1_000;

  return metrics
    .map((metric, apiIndex) => ({
      apiIndex,
      point: metricToLiveTelemetryPoint(metric),
      timestampMs: Date.parse(metric.recordedAt),
    }))
    .filter(
      ({ timestampMs }) =>
        Number.isFinite(timestampMs) &&
        timestampMs >= windowStartMs &&
        timestampMs <= asOfMs,
    )
    .sort(
      (left, right) =>
        left.timestampMs - right.timestampMs || left.apiIndex - right.apiIndex,
    )
    .map(({ point }) => point);
}

export function calculateRollingTelemetry(
  points: LiveTelemetryPoint[],
  windowSeconds = ROLLING_AVERAGE_WINDOW_SECONDS,
): RollingTelemetryPoint[] {
  const windowMs = windowSeconds * 1_000;

  const orderedPoints = points
    .map((point, apiIndex) => ({
      apiIndex,
      point,
      timestampMs: Date.parse(point.timestamp),
    }))
    .filter(({ timestampMs }) => Number.isFinite(timestampMs))
    .sort(
      (left, right) =>
        left.timestampMs - right.timestampMs || left.apiIndex - right.apiIndex,
    );

  return orderedPoints.map(({ point, timestampMs }) => {
    const windowStartMs = timestampMs - windowMs;
    const samples = orderedPoints.filter((candidate) => {
      const candidateMs = candidate.timestampMs;

      return candidateMs >= windowStartMs && candidateMs <= timestampMs;
    });
    const powerTotal = samples.reduce(
      (total, sample) => total + sample.point.power,
      0,
    );
    const temperatureTotal = samples.reduce(
      (total, sample) => total + sample.point.temperature,
      0,
    );

    return {
      ...point,
      timestampMs,
      powerRollingAverage: powerTotal / samples.length,
      temperatureRollingAverage: temperatureTotal / samples.length,
    };
  });
}
