// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useFleetDevices } from "@/hooks/use-fleet-devices";
import type { FleetDevicesResponse } from "@/lib/telemetry/contracts";

import "@/tests/frontend/setup";

const fleetResponse: FleetDevicesResponse = {
  data: {
    devices: [
      {
        id: "rack-a1",
        name: "Rack A1",
        location: "Data Hall A",
        createdAt: "2025-01-01T00:00:00.000Z",
        latestMetric: null,
      },
    ],
  },
  meta: { asOf: "2025-10-09T14:00:00.000Z" },
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("useFleetDevices", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the fleet with a no-store request and an abort signal", async () => {
    let resolveRequest!: (response: Response) => void;
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useFleetDevices());

    expect(result.current.status).toBe("loading");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/devices",
      expect.objectContaining({
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: expect.any(AbortSignal),
      }),
    );

    await act(async () => {
      resolveRequest(jsonResponse(fleetResponse));
    });

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toEqual(fleetResponse);
  });

  it("exposes a safe error and recovers through retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: {} }, 500))
      .mockResolvedValueOnce(jsonResponse(fleetResponse));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useFleetDevices());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe(
      "Unable to load fleet telemetry. Try the request again.",
    );

    act(() => result.current.retry());

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual(fleetResponse);
  });

  it("rejects a malformed successful response without crashing consumers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: { devices: [null] },
        meta: { asOf: "2025-10-09T14:00:00.000Z" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useFleetDevices());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe(
      "Unable to load fleet telemetry. Try the request again.",
    );
  });

  it("aborts an in-flight request when the consumer unmounts", () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = renderHook(() => useFleetDevices());
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const signal = requestInit.signal as AbortSignal;

    expect(signal.aborted).toBe(false);

    unmount();

    expect(signal.aborted).toBe(true);
  });
});
