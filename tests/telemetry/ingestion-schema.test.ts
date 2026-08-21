import { describe, expect, it } from "vitest";

import { telemetryIngestionSchema } from "@/lib/telemetry/ingestion-schema";

const validPayload = {
  deviceId: "rack-a1",
  power: 612,
  temperature: 77,
  timestamp: "2025-10-09T14:00:00Z",
};

describe("telemetryIngestionSchema", () => {
  it("accepts and normalizes valid telemetry", () => {
    const result = telemetryIngestionSchema.parse(validPayload);

    expect(result).toEqual({
      deviceId: "rack-a1",
      power: 612,
      temperature: 77,
      recordedAt: new Date("2025-10-09T14:00:00Z"),
    });
  });

  it("accepts timestamps with an explicit offset", () => {
    const result = telemetryIngestionSchema.parse({
      ...validPayload,
      timestamp: "2025-10-09T10:00:00-04:00",
    });

    expect(result.recordedAt.toISOString()).toBe("2025-10-09T14:00:00.000Z");
  });

  it("accepts zero measurements and a well-formed future timestamp", () => {
    const result = telemetryIngestionSchema.parse({
      ...validPayload,
      power: 0,
      temperature: 0,
      timestamp: "2099-01-01T00:00:00Z",
    });

    expect(result).toMatchObject({ power: 0, temperature: 0 });
    expect(result.recordedAt.toISOString()).toBe("2099-01-01T00:00:00.000Z");
  });

  it.each([
    "2025-10-09T14:00:00",
    "2025-02-30T14:00:00Z",
    "not-a-timestamp",
  ])("rejects invalid timestamp %s", (timestamp) => {
    const result = telemetryIngestionSchema.safeParse({
      ...validPayload,
      timestamp,
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ["power", Number.POSITIVE_INFINITY],
    ["power", Number.NaN],
    ["temperature", Number.NEGATIVE_INFINITY],
    ["temperature", Number.NaN],
  ])("rejects non-finite %s values", (field, value) => {
    const result = telemetryIngestionSchema.safeParse({
      ...validPayload,
      [field]: value,
    });

    expect(result.success).toBe(false);
  });

  it("rejects numeric strings instead of coercing them", () => {
    const result = telemetryIngestionSchema.safeParse({
      ...validPayload,
      power: "612",
    });

    expect(result.success).toBe(false);
  });

  it("rejects blank, oversized, and unknown fields", () => {
    expect(
      telemetryIngestionSchema.safeParse({ ...validPayload, deviceId: "   " })
        .success,
    ).toBe(false);
    expect(
      telemetryIngestionSchema.safeParse({
        ...validPayload,
        deviceId: "d".repeat(65),
      }).success,
    ).toBe(false);
    expect(
      telemetryIngestionSchema.safeParse({
        ...validPayload,
        receivedAt: "2025-10-09T14:00:01Z",
      }).success,
    ).toBe(false);
  });
});
