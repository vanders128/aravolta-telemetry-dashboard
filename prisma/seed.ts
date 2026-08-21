import "dotenv/config";

import { prisma } from "../lib/server/db";
import { DEMO_DEVICES } from "../lib/telemetry/demo-fleet";

const SAMPLE_INTERVAL_MS = 5_000;
const SAMPLE_COUNT = 13;

const powerOffsets = [-18, -12, -9, -5, -2, 0, 4, 7, 11, 8, 5, 3, 0];
const temperatureOffsets = [
  -0.8, -0.6, -0.4, -0.3, -0.1, 0, 0.2, 0.4, 0.6, 0.5, 0.3, 0.1, 0,
];

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

async function main() {
  const seededAt = new Date();
  const seededDeviceIds = DEMO_DEVICES.map((device) => device.id);

  const metrics = DEMO_DEVICES.flatMap((device, deviceIndex) => {
    const telemetry = device.seedTelemetry;

    if (!telemetry) {
      return [];
    }

    const latestRecordedAt = new Date(
      seededAt.getTime() -
        (telemetry.latestAgeSeconds ?? 0) * 1_000,
    );

    return Array.from({ length: SAMPLE_COUNT }, (_, sampleIndex) => {
      const ageInSamples = SAMPLE_COUNT - sampleIndex - 1;
      const recordedAt = new Date(
        latestRecordedAt.getTime() - ageInSamples * SAMPLE_INTERVAL_MS,
      );

      return {
        deviceId: device.id,
        power: roundToOneDecimal(
          telemetry.power + powerOffsets[sampleIndex],
        ),
        temperature: roundToOneDecimal(
          telemetry.temperature + temperatureOffsets[sampleIndex],
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

    for (const device of DEMO_DEVICES) {
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
    `Seeded ${DEMO_DEVICES.length} devices and ${metrics.length} telemetry readings at ${seededAt.toISOString()}.`,
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
