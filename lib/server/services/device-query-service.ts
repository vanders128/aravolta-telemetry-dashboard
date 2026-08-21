import { deviceRepository } from "@/lib/server/repositories/device-repository";
import { metricRepository } from "@/lib/server/repositories/metric-repository";
import {
  serializeMetric,
  type MetricDto,
} from "@/lib/server/serializers/metric";
import {
  createRecordedAtWindow,
  DEFAULT_TELEMETRY_WINDOW_SECONDS,
} from "@/lib/telemetry/query-window";

type DeviceDto = {
  id: string;
  name: string;
  location: string | null;
};

type FleetDeviceDto = DeviceDto & {
  createdAt: string;
  latestMetric: MetricDto | null;
};

type FoundMetricsResult = {
  outcome: "found";
  data: {
    device: DeviceDto;
    metrics: MetricDto[];
  };
  meta: {
    from: string;
    to: string;
    windowSeconds: number;
  };
};

type FoundLiveResult = {
  outcome: "found";
  data: {
    device: DeviceDto;
    latestMetric: MetricDto | null;
    metrics: MetricDto[];
  };
  meta: {
    asOf: string;
    windowSeconds: number;
  };
};

type DeviceNotFoundResult = { outcome: "device-not-found" };

function serializeDevice(device: DeviceDto): DeviceDto {
  return {
    id: device.id,
    name: device.name,
    location: device.location,
  };
}

export async function listDevices(asOf = new Date()) {
  const devices = await deviceRepository.findAllWithLatestMetric();

  return {
    devices: devices.map(
      (device): FleetDeviceDto => ({
        ...serializeDevice(device),
        createdAt: device.createdAt.toISOString(),
        latestMetric: device.metrics[0]
          ? serializeMetric(device.metrics[0])
          : null,
      }),
    ),
    asOf: asOf.toISOString(),
  };
}

export async function getRecentDeviceMetrics(
  deviceId: string,
  windowSeconds: number,
  asOf = new Date(),
): Promise<FoundMetricsResult | DeviceNotFoundResult> {
  const window = createRecordedAtWindow(asOf, windowSeconds);
  const device = await deviceRepository.findById(deviceId);

  if (!device) {
    return { outcome: "device-not-found" };
  }

  const metrics = await metricRepository.findByDeviceIdAndRecordedAtRange(
    deviceId,
    window.from,
    window.to,
  );

  return {
    outcome: "found",
    data: {
      device: serializeDevice(device),
      metrics: metrics.map(serializeMetric),
    },
    meta: {
      from: window.from.toISOString(),
      to: window.to.toISOString(),
      windowSeconds: window.windowSeconds,
    },
  };
}

export async function getLiveDeviceSnapshot(
  deviceId: string,
  asOf = new Date(),
): Promise<FoundLiveResult | DeviceNotFoundResult> {
  const window = createRecordedAtWindow(
    asOf,
    DEFAULT_TELEMETRY_WINDOW_SECONDS,
  );
  const device = await deviceRepository.findById(deviceId);

  if (!device) {
    return { outcome: "device-not-found" };
  }

  const [latestMetric, metrics] = await Promise.all([
    metricRepository.findLatestByDeviceId(deviceId),
    metricRepository.findByDeviceIdAndRecordedAtRange(
      deviceId,
      window.from,
      window.to,
    ),
  ]);

  return {
    outcome: "found",
    data: {
      device: serializeDevice(device),
      latestMetric: latestMetric ? serializeMetric(latestMetric) : null,
      metrics: metrics.map(serializeMetric),
    },
    meta: {
      asOf: window.to.toISOString(),
      windowSeconds: window.windowSeconds,
    },
  };
}
