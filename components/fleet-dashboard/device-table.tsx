import type { FleetDeviceDto } from "@/lib/telemetry/contracts";
import { getDeviceLocationLabel } from "@/lib/telemetry/fleet-dashboard";
import {
  formatPower,
  formatTemperature,
  formatTimestamp,
} from "@/lib/telemetry/formatters";

import styles from "./telemetry-dashboard.module.css";

export function DeviceTable({
  devices,
  totalDeviceCount,
}: {
  devices: FleetDeviceDto[];
  totalDeviceCount: number;
}) {
  if (totalDeviceCount === 0) {
    return (
      <div className={styles.emptyState}>
        <h3>No devices registered</h3>
        <p>Registered devices will appear here when they are available.</p>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className={styles.emptyState}>
        <h3>No devices match these filters</h3>
        <p>Adjust the search term or location to view more devices.</p>
      </div>
    );
  }

  return (
    <div
      className={styles.tableRegion}
      role="region"
      aria-label="Fleet device telemetry"
      tabIndex={0}
    >
      <table className={styles.deviceTable}>
        <caption className={styles.srOnly}>
          Registered devices and their latest telemetry readings
        </caption>
        <thead>
          <tr>
            <th scope="col">Device</th>
            <th scope="col">Location</th>
            <th scope="col" className={styles.numericColumn}>
              Latest power
            </th>
            <th scope="col" className={styles.numericColumn}>
              Latest temperature
            </th>
            <th scope="col">Last reported</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => {
            const metric = device.latestMetric;

            return (
              <tr key={device.id}>
                <th scope="row">
                  <span className={styles.deviceName} title={device.name}>
                    {device.name}
                  </span>
                  <span className={styles.deviceId}>{device.id}</span>
                </th>
                <td>{getDeviceLocationLabel(device.location)}</td>
                {metric ? (
                  <>
                    <td className={styles.numericCell}>
                      {formatPower(metric.power)}
                    </td>
                    <td className={styles.numericCell}>
                      {formatTemperature(metric.temperature)}
                    </td>
                    <td>
                      <time dateTime={metric.recordedAt} title={metric.recordedAt}>
                        {formatTimestamp(metric.recordedAt)}
                      </time>
                    </td>
                  </>
                ) : (
                  <>
                    <td
                      className={`${styles.numericCell} ${styles.missingReading}`}
                      aria-label="No power reading"
                    >
                      <span aria-hidden="true">—</span>
                    </td>
                    <td
                      className={`${styles.numericCell} ${styles.missingReading}`}
                      aria-label="No temperature reading"
                    >
                      <span aria-hidden="true">—</span>
                    </td>
                    <td className={styles.noTelemetry}>
                      <span>Never</span>
                      <small>No telemetry received</small>
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
