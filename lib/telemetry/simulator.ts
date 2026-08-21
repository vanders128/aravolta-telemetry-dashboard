import {
  SIMULATED_DEMO_DEVICES,
  type SimulatorProfile,
} from "@/lib/telemetry/demo-fleet";

export type SimulatedReading = {
  deviceId: string;
  power: number;
  temperature: number;
};

export type SimulatedTelemetryPayload = SimulatedReading & {
  timestamp: string;
};

const DRIFT_PATTERN = [-1, -0.5, 0.5, 1, 0.5, 0, -0.5, 0.5] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function nextValue(
  previous: number,
  range: SimulatorProfile["power"],
  patternIndex: number,
): number {
  const drift = DRIFT_PATTERN[patternIndex % DRIFT_PATTERN.length];

  return roundToOneDecimal(
    clamp(previous + drift * range.step, range.min, range.max),
  );
}

export function createInitialSimulatorReadings(): SimulatedReading[] {
  return SIMULATED_DEMO_DEVICES.map((device) => ({
    deviceId: device.id,
    power: device.simulatorProfile.power.baseline,
    temperature: device.simulatorProfile.temperature.baseline,
  }));
}

export function advanceSimulatorReadings(
  previousReadings: readonly SimulatedReading[],
  tick: number,
): SimulatedReading[] {
  const previousByDevice = new Map(
    previousReadings.map((reading) => [reading.deviceId, reading]),
  );

  return SIMULATED_DEMO_DEVICES.map((device) => {
    const profile = device.simulatorProfile;
    const previous = previousByDevice.get(device.id) ?? {
      deviceId: device.id,
      power: profile.power.baseline,
      temperature: profile.temperature.baseline,
    };

    return {
      deviceId: device.id,
      power: nextValue(previous.power, profile.power, tick + profile.phase),
      temperature: nextValue(
        previous.temperature,
        profile.temperature,
        tick + profile.phase + 3,
      ),
    };
  });
}

export function createSimulatorPayloads(
  readings: readonly SimulatedReading[],
  recordedAt = new Date(),
): SimulatedTelemetryPayload[] {
  const timestamp = recordedAt.toISOString();

  return readings.map((reading) => ({ ...reading, timestamp }));
}
