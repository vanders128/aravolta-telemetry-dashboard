import type {
  DeviceIdentityDto,
  FleetDeviceDto,
  FleetDevicesResponse,
  LiveDeviceSnapshotResponse,
  MetricDto,
} from "@/lib/telemetry/contracts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function isMetricDto(value: unknown): value is MetricDto {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.deviceId === "string" &&
    typeof value.power === "number" &&
    Number.isFinite(value.power) &&
    typeof value.temperature === "number" &&
    Number.isFinite(value.temperature) &&
    isTimestamp(value.recordedAt) &&
    isTimestamp(value.receivedAt)
  );
}

function isDeviceIdentityDto(value: unknown): value is DeviceIdentityDto {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.location === null || typeof value.location === "string")
  );
}

function isFleetDeviceDto(value: unknown): value is FleetDeviceDto {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    !(value.location === null || typeof value.location === "string") ||
    !isTimestamp(value.createdAt)
  ) {
    return false;
  }

  return (
    value.latestMetric === null ||
    (isMetricDto(value.latestMetric) &&
      value.latestMetric.deviceId === value.id)
  );
}

export function isFleetDevicesResponse(
  value: unknown,
): value is FleetDevicesResponse {
  if (!isRecord(value) || !isRecord(value.data) || !isRecord(value.meta)) {
    return false;
  }

  return (
    Array.isArray(value.data.devices) &&
    value.data.devices.every(isFleetDeviceDto) &&
    isTimestamp(value.meta.asOf)
  );
}

export function isLiveDeviceSnapshotResponse(
  value: unknown,
): value is LiveDeviceSnapshotResponse {
  if (!isRecord(value) || !isRecord(value.data) || !isRecord(value.meta)) {
    return false;
  }

  const device = value.data.device;
  const latestMetric = value.data.latestMetric;
  const metrics = value.data.metrics;

  if (!isDeviceIdentityDto(device)) {
    return false;
  }

  return (
    (latestMetric === null ||
      (isMetricDto(latestMetric) && latestMetric.deviceId === device.id)) &&
    Array.isArray(metrics) &&
    metrics.every(
      (metric) => isMetricDto(metric) && metric.deviceId === device.id,
    ) &&
    isTimestamp(value.meta.asOf) &&
    typeof value.meta.windowSeconds === "number" &&
    Number.isInteger(value.meta.windowSeconds) &&
    value.meta.windowSeconds > 0
  );
}
