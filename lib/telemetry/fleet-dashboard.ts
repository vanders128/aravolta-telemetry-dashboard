import type { FleetDeviceDto } from "@/lib/telemetry/contracts";

export const ALL_LOCATIONS = "__all_locations__";
export const UNASSIGNED_LOCATION = "__unassigned_location__";

export type LocationFilterValue =
  | typeof ALL_LOCATIONS
  | typeof UNASSIGNED_LOCATION
  | `location:${string}`;

export type LocationOption = {
  label: string;
  value: LocationFilterValue;
};

export type FleetSummary = {
  totalDevices: number;
  devicesWithTelemetry: number;
  aggregatePower: number | null;
  averageTemperature: number | null;
};

export function getDeviceLocationLabel(location: string | null): string {
  const normalizedLocation = location?.trim();

  return normalizedLocation || "Unassigned";
}

function toLocationFilterValue(location: string | null): LocationFilterValue {
  const normalizedLocation = location?.trim();

  return normalizedLocation
    ? `location:${normalizedLocation}`
    : UNASSIGNED_LOCATION;
}

export function getLocationOptions(
  devices: FleetDeviceDto[],
): LocationOption[] {
  const locations = new Set<string>();
  let hasUnassignedLocation = false;

  for (const device of devices) {
    const location = device.location?.trim();

    if (location) {
      locations.add(location);
    } else {
      hasUnassignedLocation = true;
    }
  }

  const options: LocationOption[] = [
    { label: "All locations", value: ALL_LOCATIONS },
    ...Array.from(locations)
      .sort((left, right) => left.localeCompare(right))
      .map((location) => ({
        label: location,
        value: `location:${location}` as const,
      })),
  ];

  if (hasUnassignedLocation) {
    options.push({
      label: "Unassigned",
      value: UNASSIGNED_LOCATION,
    });
  }

  return options;
}

export function filterFleetDevices(
  devices: FleetDeviceDto[],
  query: string,
  locationFilter: LocationFilterValue,
): FleetDeviceDto[] {
  const normalizedQuery = query.trim().toLowerCase();

  return devices.filter((device) => {
    const locationLabel = getDeviceLocationLabel(device.location);
    const matchesSearch =
      normalizedQuery.length === 0 ||
      [device.name, device.id, locationLabel].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      );
    const matchesLocation =
      locationFilter === ALL_LOCATIONS ||
      toLocationFilterValue(device.location) === locationFilter;

    return matchesSearch && matchesLocation;
  });
}

export function calculateFleetSummary(
  devices: FleetDeviceDto[],
): FleetSummary {
  const devicesWithTelemetry = devices.filter(
    (device) => device.latestMetric !== null,
  );

  if (devicesWithTelemetry.length === 0) {
    return {
      totalDevices: devices.length,
      devicesWithTelemetry: 0,
      aggregatePower: null,
      averageTemperature: null,
    };
  }

  const aggregatePower = devicesWithTelemetry.reduce(
    (sum, device) => sum + (device.latestMetric?.power ?? 0),
    0,
  );
  const aggregateTemperature = devicesWithTelemetry.reduce(
    (sum, device) => sum + (device.latestMetric?.temperature ?? 0),
    0,
  );

  return {
    totalDevices: devices.length,
    devicesWithTelemetry: devicesWithTelemetry.length,
    aggregatePower,
    averageTemperature:
      aggregateTemperature / devicesWithTelemetry.length,
  };
}
