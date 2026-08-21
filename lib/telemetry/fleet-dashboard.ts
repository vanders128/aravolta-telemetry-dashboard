import type { FleetDeviceDto } from "@/lib/telemetry/contracts";
import {
  evaluateTelemetry,
  OPERATOR_STATE_LABELS,
  type OperatorState,
} from "@/lib/telemetry/operator-state";

export const ALL_LOCATIONS = "__all_locations__";
export const UNASSIGNED_LOCATION = "__unassigned_location__";
export const ALL_STATUSES = "__all_statuses__";

export type LocationFilterValue =
  | typeof ALL_LOCATIONS
  | typeof UNASSIGNED_LOCATION
  | `location:${string}`;

export type LocationOption = {
  label: string;
  value: LocationFilterValue;
};

export type StatusFilterValue = typeof ALL_STATUSES | OperatorState;

export const STATUS_OPTIONS: ReadonlyArray<{
  label: string;
  value: StatusFilterValue;
}> = [
  { label: "All statuses", value: ALL_STATUSES },
  ...(["normal", "warning", "critical", "stale", "no-data"] as const).map(
    (state) => ({ label: OPERATOR_STATE_LABELS[state], value: state }),
  ),
];

export type FleetSummary = {
  totalDevices: number;
  normalCurrent: number;
  needsAttention: number;
  staleOrNoData: number;
  currentAggregatePower: number | null;
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
  statusFilter: StatusFilterValue = ALL_STATUSES,
  asOf: string | Date = new Date(),
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
    const matchesStatus =
      statusFilter === ALL_STATUSES ||
      evaluateTelemetry(device.latestMetric, asOf).state === statusFilter;

    return matchesSearch && matchesLocation && matchesStatus;
  });
}

export function calculateFleetSummary(
  devices: FleetDeviceDto[],
  asOf: string | Date,
): FleetSummary {
  const evaluatedDevices = devices.map((device) => ({
    device,
    evaluation: evaluateTelemetry(device.latestMetric, asOf),
  }));
  const currentDevices = evaluatedDevices.filter(
    ({ evaluation }) => evaluation.freshness === "current",
  );

  return {
    totalDevices: devices.length,
    normalCurrent: evaluatedDevices.filter(
      ({ evaluation }) => evaluation.state === "normal",
    ).length,
    needsAttention: evaluatedDevices.filter(({ evaluation }) =>
      ["warning", "critical"].includes(evaluation.state),
    ).length,
    staleOrNoData: evaluatedDevices.filter(({ evaluation }) =>
      ["stale", "no-data"].includes(evaluation.state),
    ).length,
    currentAggregatePower:
      currentDevices.length === 0
        ? null
        : currentDevices.reduce(
            (sum, { device }) => sum + (device.latestMetric?.power ?? 0),
            0,
          ),
  };
}
