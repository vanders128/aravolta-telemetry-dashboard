import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/metrics/route";
import { ingestTelemetry } from "@/lib/server/services/telemetry-ingestion-service";

vi.mock("@/lib/server/services/telemetry-ingestion-service", () => ({
  ingestTelemetry: vi.fn(),
}));

const ingestTelemetryMock = vi.mocked(ingestTelemetry);

const validPayload = {
  deviceId: "rack-a1",
  power: 612,
  temperature: 77,
  timestamp: "2025-10-09T14:00:00Z",
};

function requestWithBody(body: string) {
  return new Request("http://localhost/api/metrics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("POST /api/metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with the persisted metric", async () => {
    const metric = {
      id: "9007199254740993",
      deviceId: "rack-a1",
      power: 612,
      temperature: 77,
      recordedAt: "2025-10-09T14:00:00.000Z",
      receivedAt: "2025-10-09T14:00:00.250Z",
    };
    ingestTelemetryMock.mockResolvedValue({ outcome: "created", metric });

    const response = await POST(requestWithBody(JSON.stringify(validPayload)));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ data: metric });
    expect(ingestTelemetryMock).toHaveBeenCalledWith({
      deviceId: "rack-a1",
      power: 612,
      temperature: 77,
      recordedAt: new Date("2025-10-09T14:00:00Z"),
    });
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(requestWithBody('{"deviceId":'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INVALID_JSON",
        message: "Request body must be valid JSON.",
      },
    });
    expect(ingestTelemetryMock).not.toHaveBeenCalled();
  });

  it("returns 422 with field details for invalid telemetry", async () => {
    const response = await POST(
      requestWithBody(JSON.stringify({ ...validPayload, power: "612" })),
    );

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        message: "Telemetry payload is invalid.",
        details: [{ field: "power" }],
      },
    });
    expect(ingestTelemetryMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the device is unknown", async () => {
    ingestTelemetryMock.mockResolvedValue({ outcome: "device-not-found" });

    const response = await POST(requestWithBody(JSON.stringify(validPayload)));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "DEVICE_NOT_FOUND",
        message: "Device 'rack-a1' was not found.",
      },
    });
  });

  it("returns a sanitized 500 response for persistence failures", async () => {
    const error = new Error("database unavailable");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    ingestTelemetryMock.mockRejectedValue(error);

    const response = await POST(requestWithBody(JSON.stringify(validPayload)));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unable to persist telemetry.",
      },
    });
    expect(consoleError).toHaveBeenCalledWith("Telemetry ingestion failed.", error);
  });
});
