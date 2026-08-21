import {
  advanceSimulatorReadings,
  createInitialSimulatorReadings,
  type SimulatedReading,
} from "../lib/telemetry/simulator";

const SIMULATOR_CADENCE_MS = 5_000;
const DEFAULT_BASE_URL = "http://localhost:3000";
const configuredBaseUrl =
  process.env.TELEMETRY_API_BASE_URL?.trim() || DEFAULT_BASE_URL;
const baseUrl = configuredBaseUrl.replace(/\/$/, "");

let stopped = false;
let tick = 0;
let readings = createInitialSimulatorReadings();

function stop() {
  stopped = true;
  console.log("\nTelemetry simulator stopped.");
}

process.once("SIGINT", stop);
process.once("SIGTERM", stop);

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function sendReading(reading: SimulatedReading, timestamp: string) {
  const response = await fetch(`${baseUrl}/api/metrics`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...reading, timestamp }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `${reading.deviceId}: ingestion returned ${response.status} ${body}`,
    );
  }
}

async function runCycle() {
  readings = advanceSimulatorReadings(readings, tick);
  tick += 1;
  const timestamp = new Date().toISOString();
  const results = await Promise.allSettled(
    readings.map((reading) => sendReading(reading, timestamp)),
  );
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(failure.reason);
    }
    console.error(
      `Cycle ${tick} completed with ${failures.length} ingestion failure(s).`,
    );
    return;
  }

  console.log(
    `${timestamp} · cycle ${tick}: persisted ${readings.length} device readings`,
  );
}

async function main() {
  console.log(
    `Telemetry simulator targeting ${baseUrl} every ${SIMULATOR_CADENCE_MS / 1_000}s. Press Ctrl+C to stop.`,
  );

  while (!stopped) {
    try {
      await runCycle();
    } catch (error) {
      console.error("Simulator cycle failed.", error);
    }

    if (!stopped) {
      await delay(SIMULATOR_CADENCE_MS);
    }
  }
}

void main();
