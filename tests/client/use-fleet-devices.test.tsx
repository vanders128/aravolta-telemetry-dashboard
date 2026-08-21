// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FLEET_POLL_INTERVAL_MS,
  useFleetDevices,
} from "@/hooks/use-fleet-devices";
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

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;

  return {
    promise: new Promise<T>((promiseResolve) => {
      resolve = promiseResolve;
    }),
    resolve,
  };
}

async function settlePromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useFleetDevices", () => {
  afterEach(() => {
    vi.useRealTimers();
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
    expect(result.current.refreshError).toBeNull();
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

  it("polls only after the previous request completes", async () => {
    vi.useFakeTimers();
    const firstRequest = deferred<Response>();
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(firstRequest.promise)
      .mockResolvedValue(jsonResponse(fleetResponse));
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useFleetDevices());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FLEET_POLL_INTERVAL_MS * 3);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    firstRequest.resolve(jsonResponse(fleetResponse));
    await settlePromises();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FLEET_POLL_INTERVAL_MS - 1);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retains successful fleet data after a background failure and recovers", async () => {
    vi.useFakeTimers();
    const recovered = {
      ...fleetResponse,
      meta: { asOf: "2025-10-09T14:00:15.000Z" },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(fleetResponse))
      .mockResolvedValueOnce(jsonResponse({ error: {} }, 500))
      .mockResolvedValueOnce(jsonResponse(recovered));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useFleetDevices());
    await settlePromises();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FLEET_POLL_INTERVAL_MS);
    });
    expect(result.current.status).toBe("success");
    expect(result.current.data).toEqual(fleetResponse);
    expect(result.current.refreshError).toMatch(/last successful snapshot/i);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FLEET_POLL_INTERVAL_MS);
    });
    expect(result.current.data).toEqual(recovered);
    expect(result.current.refreshError).toBeNull();
  });

  it("does not update state when an aborted request resolves after unmount", async () => {
    const request = deferred<Response>();
    const fetchMock = vi.fn().mockReturnValue(request.promise);
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = renderHook(() => useFleetDevices());

    unmount();
    request.resolve(jsonResponse(fleetResponse));
    await settlePromises();

    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).signal).toMatchObject({
      aborted: true,
    });
  });

  it("cleans up a scheduled poll after unmount", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(fleetResponse));
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = renderHook(() => useFleetDevices());
    await settlePromises();

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FLEET_POLL_INTERVAL_MS * 2);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not let an ignored aborted retry response overwrite newer data", async () => {
    const firstRequest = deferred<Response>();
    const secondRequest = deferred<Response>();
    const recovered = {
      ...fleetResponse,
      meta: { asOf: "2025-10-09T14:00:15.000Z" },
    };
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useFleetDevices());
    const firstSignal = (fetchMock.mock.calls[0]?.[1] as RequestInit)
      .signal as AbortSignal;

    act(() => result.current.retry());
    expect(firstSignal.aborted).toBe(true);

    secondRequest.resolve(jsonResponse(recovered));
    await settlePromises();
    expect(result.current.data).toEqual(recovered);

    firstRequest.resolve(jsonResponse(fleetResponse));
    await settlePromises();
    expect(result.current.data).toEqual(recovered);
  });
});
