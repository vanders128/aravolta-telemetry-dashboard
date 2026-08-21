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

export type FleetDevicesResponse = {
  data: {
    devices: FleetDeviceDto[];
  };
  meta: {
    asOf: string;
  };
};
