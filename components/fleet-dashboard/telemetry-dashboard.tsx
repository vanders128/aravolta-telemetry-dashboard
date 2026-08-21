"use client";

import { useMemo, useState } from "react";

import { useFleetDevices } from "@/hooks/use-fleet-devices";
import type { FleetDeviceDto } from "@/lib/telemetry/contracts";
import {
  ALL_LOCATIONS,
  ALL_STATUSES,
  calculateFleetSummary,
  filterFleetDevices,
  getLocationOptions,
  type LocationFilterValue,
  type StatusFilterValue,
} from "@/lib/telemetry/fleet-dashboard";
import { formatTimestamp } from "@/lib/telemetry/formatters";

import { DashboardError, DashboardLoading } from "./dashboard-feedback";
import { DeviceDetailPane } from "./device-detail-pane";
import { DeviceFilters } from "./device-filters";
import { DeviceTable } from "./device-table";
import { FleetSummary } from "./fleet-summary";
import styles from "./telemetry-dashboard.module.css";

const EMPTY_DEVICES: FleetDeviceDto[] = [];

function DashboardHeader({
  asOf,
  isRefreshing,
  refreshError,
}: {
  asOf?: string;
  isRefreshing: boolean;
  refreshError: string | null;
}) {
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
          <small>
            {isRefreshing
              ? "Refreshing fleet…"
              : refreshError ?? "Fleet refreshes every 15s"}
          </small>
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
  const [statusFilter, setStatusFilter] =
    useState<StatusFilterValue>(ALL_STATUSES);
  const [explicitSelectedDeviceId, setExplicitSelectedDeviceId] = useState<
    string | null
  >(null);

  const devices = fleet.data?.data.devices ?? EMPTY_DEVICES;
  const asOf = fleet.data?.meta.asOf ?? new Date(0).toISOString();
  const summary = useMemo(
    () => calculateFleetSummary(devices, asOf),
    [asOf, devices],
  );
  const locationOptions = useMemo(
    () => getLocationOptions(devices),
    [devices],
  );
  const visibleDevices = useMemo(
    () =>
      filterFleetDevices(devices, query, locationFilter, statusFilter, asOf),
    [asOf, devices, locationFilter, query, statusFilter],
  );
  const filtersAreActive =
    query.trim().length > 0 ||
    locationFilter !== ALL_LOCATIONS ||
    statusFilter !== ALL_STATUSES;
  const selectedDevice = useMemo(
    () =>
      devices.find((device) => device.id === explicitSelectedDeviceId) ??
      devices[0] ??
      null,
    [devices, explicitSelectedDeviceId],
  );
  const isSelectionFilteredOut =
    selectedDevice !== null &&
    !visibleDevices.some((device) => device.id === selectedDevice.id);

  function clearFilters() {
    setQuery("");
    setLocationFilter(ALL_LOCATIONS);
    setStatusFilter(ALL_STATUSES);
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <DashboardHeader
          asOf={fleet.data?.meta.asOf}
          isRefreshing={fleet.isRefreshing}
          refreshError={fleet.refreshError}
        />

        {fleet.status === "loading" ? <DashboardLoading /> : null}
        {fleet.status === "error" ? (
          <DashboardError message={fleet.error} onRetry={fleet.retry} />
        ) : null}

        {fleet.status === "success" ? (
          <div className={styles.workspace}>
            <FleetSummary summary={summary} />

            <div className={styles.operationsGrid}>
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
                    statusFilter={statusFilter}
                    locationOptions={locationOptions}
                    visibleCount={visibleDevices.length}
                    totalCount={devices.length}
                    filtersAreActive={filtersAreActive}
                    onQueryChange={setQuery}
                    onLocationChange={setLocationFilter}
                    onStatusChange={setStatusFilter}
                    onClear={clearFilters}
                  />
                ) : null}

                <DeviceTable
                  devices={visibleDevices}
                  totalDeviceCount={devices.length}
                  selectedDeviceId={selectedDevice?.id ?? null}
                  asOf={asOf}
                  onSelectDevice={setExplicitSelectedDeviceId}
                />
              </section>

              <DeviceDetailPane
                device={selectedDevice}
                isSelectionFilteredOut={isSelectionFilteredOut}
              />
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
