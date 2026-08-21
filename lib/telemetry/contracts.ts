export type MetricDto = {
  id: string;
  deviceId: string;
  power: number;
  temperature: number;
  recordedAt: string;
  receivedAt: string;
};

export type FleetDeviceDto = {
  id: string;
  name: string;
  location: string | null;
  createdAt: string;
  latestMetric: MetricDto | null;
};

export type DeviceIdentityDto = Pick<
  FleetDeviceDto,
  "id" | "name" | "location"
>;

export type FleetDevicesResponse = {
  data: {
    devices: FleetDeviceDto[];
  };
  meta: {
    asOf: string;
  };
};

export type LiveDeviceSnapshotResponse = {
  data: {
    device: DeviceIdentityDto;
    latestMetric: MetricDto | null;
    metrics: MetricDto[];
  };
  meta: {
    asOf: string;
    windowSeconds: number;
  };
};

// Assignment-facing chart shape. The API and database continue to use
// recordedAt/receivedAt; the client explicitly maps recordedAt to timestamp.
export type LiveTelemetryPoint = {
  power: number;
  temperature: number;
  timestamp: string;
};

export type RollingTelemetryPoint = LiveTelemetryPoint & {
  timestampMs: number;
  powerRollingAverage: number;
  temperatureRollingAverage: number;
};
