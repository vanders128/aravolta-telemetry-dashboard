import "dotenv/config";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { POST } from "@/app/api/metrics/route";
import { prisma } from "@/lib/server/db";
import { metricRepository } from "@/lib/server/repositories/metric-repository";
import {
  getLiveDeviceSnapshot,
  getRecentDeviceMetrics,
} from "@/lib/server/services/device-query-service";

const TEST_DEVICE_ID = `phase8-hardening-${process.pid}`;
const TEST_DEVICE = {
  id: TEST_DEVICE_ID,
  name: "Phase 8 hardening device",
  location: "Test isolation",
};

function ingestionRequest({
  power = 612,
  temperature = 77,
  timestamp = "2025-10-09T14:00:00.000Z",
}: {
  power?: number;
  temperature?: number;
  timestamp?: string;
} = {}) {
  return new Request("http://localhost/api/metrics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deviceId: TEST_DEVICE_ID,
      power,
      temperature,
      timestamp,
    }),
  });
}

async function clearTestDevice() {
  await prisma.metric.deleteMany({ where: { deviceId: TEST_DEVICE_ID } });
  await prisma.device.deleteMany({ where: { id: TEST_DEVICE_ID } });
}

describe.runIf(Boolean(process.env.DATABASE_URL)).sequential(
  "telemetry PostgreSQL behavior",
  () => {
    beforeAll(async () => {
      await clearTestDevice();
      await prisma.device.create({ data: TEST_DEVICE });
    });

    afterEach(async () => {
      await prisma.metric.deleteMany({ where: { deviceId: TEST_DEVICE_ID } });
    });

    afterAll(async () => {
      await clearTestDevice();
      await prisma.$disconnect();
    });

    it("persists identical retry-like submissions as distinct events", async () => {
      const firstResponse = await POST(ingestionRequest());
      const secondResponse = await POST(ingestionRequest());
      const firstBody = (await firstResponse.json()) as {
        data: { id: string; recordedAt: string; receivedAt: string };
      };
      const secondBody = (await secondResponse.json()) as {
        data: { id: string; recordedAt: string; receivedAt: string };
      };
      const persisted = await prisma.metric.findMany({
        where: { deviceId: TEST_DEVICE_ID },
        orderBy: { id: "asc" },
      });

      expect(firstResponse.status).toBe(201);
      expect(secondResponse.status).toBe(201);
      expect(persisted).toHaveLength(2);
      expect(persisted[0]?.recordedAt).toEqual(persisted[1]?.recordedAt);
      expect(persisted[0]?.power).toBe(persisted[1]?.power);
      expect(firstBody.data.id).not.toBe(secondBody.data.id);
      expect(typeof firstBody.data.id).toBe("string");
      expect(firstBody.data.recordedAt).toBe("2025-10-09T14:00:00.000Z");
      expect(Number.isNaN(Date.parse(firstBody.data.receivedAt))).toBe(false);
      expect(() => JSON.stringify(firstBody)).not.toThrow();
    });

    it("uses ID only as a deterministic tie-breaker for equal event times", async () => {
      const firstResponse = await POST(ingestionRequest({ power: 100 }));
      const secondResponse = await POST(ingestionRequest({ power: 200 }));
      const firstBody = (await firstResponse.json()) as { data: { id: string } };
      const secondBody = (await secondResponse.json()) as { data: { id: string } };
      const latest = await metricRepository.findLatestByDeviceId(TEST_DEVICE_ID);
      const history = await metricRepository.findByDeviceIdAndRecordedAtRange(
        TEST_DEVICE_ID,
        new Date("2025-10-09T13:59:00.000Z"),
        new Date("2025-10-09T14:01:00.000Z"),
      );

      expect(latest?.id.toString()).toBe(secondBody.data.id);
      expect(latest?.power).toBe(200);
      expect(history.map((reading) => reading.id.toString())).toEqual([
        firstBody.data.id,
        secondBody.data.id,
      ]);
    });

    it("accepts late telemetry while keeping latest and history in event-time order", async () => {
      const newerResponse = await POST(
        ingestionRequest({
          power: 900,
          timestamp: "2025-10-09T14:00:00.000Z",
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 20));
      const olderResponse = await POST(
        ingestionRequest({
          power: 500,
          timestamp: "2025-10-09T13:59:30.000Z",
        }),
      );
      const newerBody = (await newerResponse.json()) as {
        data: { receivedAt: string };
      };
      const olderBody = (await olderResponse.json()) as {
        data: { receivedAt: string };
      };
      const latest = await metricRepository.findLatestByDeviceId(TEST_DEVICE_ID);
      const history = await metricRepository.findByDeviceIdAndRecordedAtRange(
        TEST_DEVICE_ID,
        new Date("2025-10-09T13:59:00.000Z"),
        new Date("2025-10-09T14:01:00.000Z"),
      );

      expect(newerResponse.status).toBe(201);
      expect(olderResponse.status).toBe(201);
      expect(latest?.power).toBe(900);
      expect(history.map((reading) => reading.power)).toEqual([500, 900]);
      expect(Date.parse(olderBody.data.receivedAt)).toBeGreaterThanOrEqual(
        Date.parse(newerBody.data.receivedAt),
      );
    });

    it("allows a future event to become latest but excludes it above the live window", async () => {
      const asOf = new Date("2025-10-09T14:00:00.000Z");
      const response = await POST(
        ingestionRequest({ timestamp: "2025-10-09T14:05:00.000Z" }),
      );
      const live = await getLiveDeviceSnapshot(TEST_DEVICE_ID, asOf);
      const recent = await getRecentDeviceMetrics(TEST_DEVICE_ID, 60, asOf);

      expect(response.status).toBe(201);
      expect(live).toMatchObject({
        outcome: "found",
        data: {
          latestMetric: { recordedAt: "2025-10-09T14:05:00.000Z" },
          metrics: [],
        },
      });
      expect(recent).toMatchObject({
        outcome: "found",
        data: { metrics: [] },
      });
    });

    it("enforces the foreign key and ON DELETE RESTRICT", async () => {
      await POST(ingestionRequest());

      await expect(
        prisma.device.delete({ where: { id: TEST_DEVICE_ID } }),
      ).rejects.toMatchObject({ code: "P2003" });
      await expect(
        metricRepository.createMetric({
          deviceId: `${TEST_DEVICE_ID}-missing`,
          power: 100,
          temperature: 50,
          recordedAt: new Date("2025-10-09T14:00:00.000Z"),
        }),
      ).rejects.toMatchObject({ code: "P2003" });

      await expect(
        prisma.device.count({ where: { id: TEST_DEVICE_ID } }),
      ).resolves.toBe(1);
      await expect(
        prisma.metric.count({ where: { deviceId: TEST_DEVICE_ID } }),
      ).resolves.toBe(1);
    });

    it("returns 404 for an unknown device without creating telemetry", async () => {
      const missingDeviceId = `${TEST_DEVICE_ID}-missing`;
      const request = new Request("http://localhost/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: missingDeviceId,
          power: 0,
          temperature: 0,
          timestamp: "2025-10-09T14:00:00.000Z",
        }),
      });
      const response = await POST(request);

      expect(response.status).toBe(404);
      await expect(
        prisma.metric.count({ where: { deviceId: missingDeviceId } }),
      ).resolves.toBe(0);
    });
  },
);
