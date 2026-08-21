export type SimulatorProfileKind = "normal" | "warning" | "critical";

export type SimulatorProfile = {
  kind: SimulatorProfileKind;
  power: { baseline: number; min: number; max: number; step: number };
  temperature: { baseline: number; min: number; max: number; step: number };
  phase: number;
};

export type DemoDevice = {
  id: string;
  name: string;
  location: string;
  seedTelemetry: {
    power: number;
    temperature: number;
    latestAgeSeconds?: number;
  } | null;
  simulatorProfile: SimulatorProfile | null;
};

function simulatorProfile(
  kind: SimulatorProfileKind,
  power: [baseline: number, min: number, max: number, step: number],
  temperature: [baseline: number, min: number, max: number, step: number],
  phase: number,
): SimulatorProfile {
  return {
    kind,
    power: {
      baseline: power[0],
      min: power[1],
      max: power[2],
      step: power[3],
    },
    temperature: {
      baseline: temperature[0],
      min: temperature[1],
      max: temperature[2],
      step: temperature[3],
    },
    phase,
  };
}

export const NO_DATA_DEMO_DEVICE_ID = "rack-c1";
export const STALE_DEMO_DEVICE_ID = "pdu-b1";

export const DEMO_DEVICES: readonly DemoDevice[] = [
  {
    id: "rack-a1",
    name: "Rack A1",
    location: "Data Hall A",
    seedTelemetry: { power: 610, temperature: 76 },
    simulatorProfile: simulatorProfile(
      "normal",
      [610, 570, 680, 7],
      [76, 73, 81, 0.4],
      0,
    ),
  },
  {
    id: "rack-a2",
    name: "Rack A2",
    location: "Data Hall A",
    seedTelemetry: { power: 545, temperature: 73 },
    simulatorProfile: simulatorProfile(
      "normal",
      [545, 510, 620, 6],
      [73, 70, 79, 0.3],
      1,
    ),
  },
  {
    id: "rack-a3",
    name: "Rack A3",
    location: "Data Hall A",
    seedTelemetry: { power: 720, temperature: 79 },
    simulatorProfile: simulatorProfile(
      "normal",
      [720, 670, 790, 8],
      [79, 76, 83, 0.3],
      2,
    ),
  },
  {
    id: "rack-b1",
    name: "Rack B1",
    location: "Data Hall B",
    seedTelemetry: { power: 835, temperature: 82 },
    simulatorProfile: simulatorProfile(
      "normal",
      [835, 780, 940, 9],
      [82, 78, 84.5, 0.25],
      3,
    ),
  },
  {
    id: "rack-b2",
    name: "Rack B2",
    location: "Data Hall B",
    seedTelemetry: { power: 1_290, temperature: 97 },
    simulatorProfile: simulatorProfile(
      "critical",
      [1_290, 1_260, 1_350, 6],
      [97, 96, 99, 0.2],
      4,
    ),
  },
  {
    id: NO_DATA_DEMO_DEVICE_ID,
    name: "Rack C1",
    location: "Data Hall C",
    seedTelemetry: null,
    simulatorProfile: null,
  },
  {
    id: "ups-01",
    name: "UPS 01",
    location: "Power Room",
    seedTelemetry: { power: 1_100, temperature: 89 },
    simulatorProfile: simulatorProfile(
      "warning",
      [1_100, 1_050, 1_150, 7],
      [89, 86, 92, 0.35],
      5,
    ),
  },
  {
    id: "ups-02",
    name: "UPS 02",
    location: "Power Room",
    seedTelemetry: { power: 880, temperature: 78 },
    simulatorProfile: simulatorProfile(
      "normal",
      [880, 830, 960, 8],
      [78, 75, 83, 0.3],
      6,
    ),
  },
  {
    id: "cooling-01",
    name: "Cooling Unit 01",
    location: "Mechanical Room",
    seedTelemetry: { power: 455, temperature: 68 },
    simulatorProfile: simulatorProfile(
      "normal",
      [455, 420, 520, 6],
      [68, 65, 73, 0.3],
      7,
    ),
  },
  {
    id: "cooling-02",
    name: "Cooling Unit 02",
    location: "Mechanical Room",
    seedTelemetry: { power: 490, temperature: 70 },
    simulatorProfile: simulatorProfile(
      "normal",
      [490, 450, 550, 6],
      [70, 67, 75, 0.3],
      8,
    ),
  },
  {
    id: "pdu-a1",
    name: "PDU A1",
    location: "Data Hall A",
    seedTelemetry: { power: 760, temperature: 74 },
    simulatorProfile: simulatorProfile(
      "normal",
      [760, 710, 840, 8],
      [74, 71, 80, 0.3],
      9,
    ),
  },
  {
    id: STALE_DEMO_DEVICE_ID,
    name: "PDU B1",
    location: "Data Hall B",
    seedTelemetry: {
      power: 740,
      temperature: 80,
      latestAgeSeconds: 90,
    },
    simulatorProfile: null,
  },
] as const;

export const SIMULATED_DEMO_DEVICES = DEMO_DEVICES.filter(
  (device): device is DemoDevice & { simulatorProfile: SimulatorProfile } =>
    device.simulatorProfile !== null,
);
