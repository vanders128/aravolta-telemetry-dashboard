"use client";

import { useMemo } from "react";

import { useLiveTelemetry } from "@/hooks/use-live-telemetry";
import type { FleetDeviceDto } from "@/lib/telemetry/contracts";
import { getDeviceLocationLabel } from "@/lib/telemetry/fleet-dashboard";
import {
  formatPower,
  formatTemperature,
  formatTimestamp,
} from "@/lib/telemetry/formatters";
import {
  calculateRollingTelemetry,
  LIVE_TELEMETRY_POLL_INTERVAL_MS,
  LIVE_TELEMETRY_WINDOW_SECONDS,
  prepareLiveTelemetryPoints,
} from "@/lib/telemetry/live-telemetry";

import styles from "./telemetry-dashboard.module.css";
import { TelemetryChart } from "./telemetry-chart";

function DetailReadings({
  latestMetric,
}: {
  latestMetric: FleetDeviceDto["latestMetric"];
}) {
  return (
    <dl className={styles.detailReadings} aria-label="Latest known readings">
      <div>
        <dt>Latest known power</dt>
        <dd>{latestMetric ? formatPower(latestMetric.power) : "—"}</dd>
      </div>
      <div>
        <dt>Latest known temperature</dt>
        <dd>
          {latestMetric ? formatTemperature(latestMetric.temperature) : "—"}
        </dd>
      </div>
      <div>
        <dt>Last reported</dt>
        <dd>
          {latestMetric ? (
            <time
              dateTime={latestMetric.recordedAt}
              title={latestMetric.recordedAt}
            >
              {formatTimestamp(latestMetric.recordedAt)}
            </time>
          ) : (
            "Never"
          )}
        </dd>
      </div>
    </dl>
  );
}

export function DeviceDetailPane({
  device,
  isSelectionFilteredOut,
}: {
  device: FleetDeviceDto | null;
  isSelectionFilteredOut: boolean;
}) {
  const live = useLiveTelemetry(device?.id ?? null);
  const snapshot = live.data;
  const latestMetric = snapshot?.data.latestMetric ?? null;
  const chartPoints = useMemo(() => {
    if (snapshot === null) {
      return [];
    }

    return calculateRollingTelemetry(
      prepareLiveTelemetryPoints(
        snapshot.data.metrics,
        snapshot.meta.asOf,
        LIVE_TELEMETRY_WINDOW_SECONDS,
      ),
    );
  }, [snapshot]);
  const windowEndMs = snapshot ? Date.parse(snapshot.meta.asOf) : 0;
  const windowStartMs =
    windowEndMs - LIVE_TELEMETRY_WINDOW_SECONDS * 1_000;

  if (device === null) {
    return (
      <aside
        id="device-detail-pane"
        className={`${styles.detailPane} ${styles.detailPaneEmpty}`}
        aria-labelledby="device-detail-empty-title"
      >
        <p className={styles.stateEyebrow}>Live telemetry</p>
        <h2 id="device-detail-empty-title">Select a device</h2>
        <p>Choose a fleet device to inspect its current telemetry window.</p>
      </aside>
    );
  }

  return (
    <aside
      id="device-detail-pane"
      className={styles.detailPane}
      aria-labelledby="device-detail-title"
    >
      <header className={styles.detailHeader}>
        <div className={styles.detailIdentity}>
          <p className={styles.stateEyebrow}>Selected device / Live telemetry</p>
          <h2 id="device-detail-title">{device.name}</h2>
          <p>
            <span className={styles.detailDeviceId}>{device.id}</span>
            <span aria-hidden="true"> · </span>
            {getDeviceLocationLabel(device.location)}
          </p>
        </div>
        <div className={styles.pollingSummary}>
          <span className={styles.pollingIndicator} aria-hidden="true" />
          <span>
            {live.isRefreshing
              ? "Refreshing snapshot…"
              : `Auto-refreshing every ${LIVE_TELEMETRY_POLL_INTERVAL_MS / 1_000}s`}
          </span>
          <small>Telemetry window: last 60s</small>
        </div>
      </header>

      {isSelectionFilteredOut ? (
        <p className={styles.selectionContext}>
          Selected device is outside the current fleet filters.
        </p>
      ) : null}

      {live.status === "loading" ? (
        <div
          className={styles.detailState}
          role="status"
          aria-label="Loading selected-device telemetry"
        >
          <span className={styles.loadingMark} aria-hidden="true" />
          <h3>Loading telemetry window</h3>
          <p>The fleet table remains available while this device loads.</p>
        </div>
      ) : null}

      {live.status === "error" ? (
        <div className={styles.detailState} role="alert">
          <h3>Device telemetry is temporarily unavailable</h3>
          <p>{live.error}</p>
          <button type="button" onClick={live.retry}>
            Retry device request
          </button>
        </div>
      ) : null}

      {live.status === "success" && snapshot ? (
        <div className={styles.detailContent}>
          <DetailReadings latestMetric={latestMetric} />

          <div className={styles.snapshotMeta}>
            <span>
              Updated{" "}
              <time dateTime={snapshot.meta.asOf} title={snapshot.meta.asOf}>
                {formatTimestamp(snapshot.meta.asOf)}
              </time>
            </span>
            {live.refreshError ? (
              <span className={styles.refreshWarning}>{live.refreshError}</span>
            ) : null}
          </div>

          {latestMetric === null ? (
            <div className={styles.detailState}>
              <h3>No telemetry received</h3>
              <p>
                This registered device has not reported power or temperature
                readings.
              </p>
            </div>
          ) : chartPoints.length === 0 ? (
            <div className={styles.detailState}>
              <h3>No telemetry in the current 60-second window</h3>
              <p>The latest known reading remains available above.</p>
            </div>
          ) : (
            <div className={styles.chartStack}>
              <TelemetryChart
                metric="power"
                points={chartPoints}
                windowStartMs={windowStartMs}
                windowEndMs={windowEndMs}
              />
              <TelemetryChart
                metric="temperature"
                points={chartPoints}
                windowStartMs={windowStartMs}
                windowEndMs={windowEndMs}
              />
            </div>
          )}
        </div>
      ) : null}
    </aside>
  );
}
