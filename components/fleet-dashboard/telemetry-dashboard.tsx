"use client";

import { useMemo, useState } from "react";

import { useFleetDevices } from "@/hooks/use-fleet-devices";
import type { FleetDeviceDto } from "@/lib/telemetry/contracts";
import {
  ALL_LOCATIONS,
  calculateFleetSummary,
  filterFleetDevices,
  getLocationOptions,
  type LocationFilterValue,
} from "@/lib/telemetry/fleet-dashboard";
import { formatTimestamp } from "@/lib/telemetry/formatters";

import { DashboardError, DashboardLoading } from "./dashboard-feedback";
import { DeviceFilters } from "./device-filters";
import { DeviceTable } from "./device-table";
import { FleetSummary } from "./fleet-summary";
import styles from "./telemetry-dashboard.module.css";

const EMPTY_DEVICES: FleetDeviceDto[] = [];

function DashboardHeader({ asOf }: { asOf?: string }) {
  return (
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>Operations / Fleet</p>
        <h1>Fleet telemetry</h1>
        <p className={styles.headerDescription}>
          Latest reported power and temperature across registered devices.
        </p>
      </div>
      {asOf ? (
        <p className={styles.snapshotTime}>
          Snapshot
          <time dateTime={asOf} title={asOf}>
            {formatTimestamp(asOf)}
          </time>
        </p>
      ) : null}
    </header>
  );
}

export function TelemetryDashboard() {
  const fleet = useFleetDevices();
  const [query, setQuery] = useState("");
  const [locationFilter, setLocationFilter] =
    useState<LocationFilterValue>(ALL_LOCATIONS);

  const devices = fleet.data?.data.devices ?? EMPTY_DEVICES;
  const summary = useMemo(() => calculateFleetSummary(devices), [devices]);
  const locationOptions = useMemo(
    () => getLocationOptions(devices),
    [devices],
  );
  const visibleDevices = useMemo(
    () => filterFleetDevices(devices, query, locationFilter),
    [devices, locationFilter, query],
  );
  const filtersAreActive =
    query.trim().length > 0 || locationFilter !== ALL_LOCATIONS;

  function clearFilters() {
    setQuery("");
    setLocationFilter(ALL_LOCATIONS);
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <DashboardHeader asOf={fleet.data?.meta.asOf} />

        {fleet.status === "loading" ? <DashboardLoading /> : null}
        {fleet.status === "error" ? (
          <DashboardError message={fleet.error} onRetry={fleet.retry} />
        ) : null}

        {fleet.status === "success" ? (
          <div className={styles.workspace}>
            <FleetSummary summary={summary} />

            <section
              className={styles.fleetPanel}
              aria-labelledby="device-inventory-title"
            >
              <div className={styles.panelHeader}>
                <div>
                  <h2 id="device-inventory-title">Device inventory</h2>
                  <p>Latest known readings from the fleet API.</p>
                </div>
                <span className={styles.deviceTotal}>
                  {devices.length.toLocaleString("en-US")} registered
                </span>
              </div>

              {devices.length > 0 ? (
                <DeviceFilters
                  query={query}
                  locationFilter={locationFilter}
                  locationOptions={locationOptions}
                  visibleCount={visibleDevices.length}
                  totalCount={devices.length}
                  filtersAreActive={filtersAreActive}
                  onQueryChange={setQuery}
                  onLocationChange={setLocationFilter}
                  onClear={clearFilters}
                />
              ) : null}

              <DeviceTable
                devices={visibleDevices}
                totalDeviceCount={devices.length}
              />
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
