import "dotenv/config";

import { prisma } from "../lib/server/db";

const SAMPLE_INTERVAL_MS = 5_000;
const SAMPLE_COUNT = 13;

const powerOffsets = [-18, -12, -9, -5, -2, 0, 4, 7, 11, 8, 5, 3, 0];
const temperatureOffsets = [
  -0.8, -0.6, -0.4, -0.3, -0.1, 0, 0.2, 0.4, 0.6, 0.5, 0.3, 0.1, 0,
];

const deviceSeeds = [
  {
    id: "rack-a1",
    name: "Rack A1",
    location: "Data Hall A",
    telemetry: { power: 610, temperature: 76 },
  },
  {
    id: "rack-a2",
    name: "Rack A2",
    location: "Data Hall A",
    telemetry: { power: 545, temperature: 73 },
  },
  {
    id: "rack-b1",
    name: "Rack B1",
    location: "Data Hall B",
    telemetry: { power: 835, temperature: 84 },
  },
  {
    id: "cooling-01",
    name: "Cooling Unit 01",
    location: "Mechanical Room",
    telemetry: { power: 455, temperature: 68 },
  },
  {
    id: "ups-01",
    name: "UPS 01",
    location: "Power Room",
    telemetry: { power: 1_055, temperature: 93 },
  },
  {
    id: "rack-c1",
    name: "Rack C1",
    location: "Data Hall C",
    telemetry: null,
  },
] as const;

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

async function main() {
  const seededAt = new Date();
  const seededDeviceIds = deviceSeeds.map((device) => device.id);

  const metrics = deviceSeeds.flatMap((device, deviceIndex) => {
    if (!device.telemetry) {
      return [];
    }

    return Array.from({ length: SAMPLE_COUNT }, (_, sampleIndex) => {
      const ageInSamples = SAMPLE_COUNT - sampleIndex - 1;
      const recordedAt = new Date(
        seededAt.getTime() - ageInSamples * SAMPLE_INTERVAL_MS,
      );

      return {
        deviceId: device.id,
        power: roundToOneDecimal(
          device.telemetry.power + powerOffsets[sampleIndex],
        ),
        temperature: roundToOneDecimal(
          device.telemetry.temperature + temperatureOffsets[sampleIndex],
        ),
        recordedAt,
        receivedAt: new Date(recordedAt.getTime() + 200 + deviceIndex * 25),
      };
    });
  });

  await prisma.$transaction(async (transaction) => {
    await transaction.metric.deleteMany({
      where: { deviceId: { in: seededDeviceIds } },
    });

    for (const device of deviceSeeds) {
      await transaction.device.upsert({
        where: { id: device.id },
        create: {
          id: device.id,
          name: device.name,
          location: device.location,
        },
        update: {
          name: device.name,
          location: device.location,
        },
      });
    }

    await transaction.metric.createMany({ data: metrics });
  });

  console.log(
    `Seeded ${deviceSeeds.length} devices and ${metrics.length} telemetry readings at ${seededAt.toISOString()}.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("Database seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
