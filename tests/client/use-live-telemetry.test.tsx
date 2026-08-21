// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useLiveTelemetry } from "@/hooks/use-live-telemetry";
import type { LiveDeviceSnapshotResponse } from "@/lib/telemetry/contracts";
import { LIVE_TELEMETRY_POLL_INTERVAL_MS } from "@/lib/telemetry/live-telemetry";

import "@/tests/frontend/setup";

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

function snapshot(
  deviceId: string,
  metricId = "metric-1",
): LiveDeviceSnapshotResponse {
  const metric = {
    id: metricId,
    deviceId,
    power: 612,
    temperature: 77,
    recordedAt: "2025-10-09T13:59:55.000Z",
    receivedAt: "2025-10-09T13:59:56.000Z",
  };

  return {
    data: {
      device: { id: deviceId, name: deviceId, location: "Data Hall A" },
      latestMetric: metric,
      metrics: [metric],
    },
    meta: { asOf: "2025-10-09T14:00:00.000Z", windowSeconds: 60 },
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function settlePromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useLiveTelemetry", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not poll without a selected device", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useLiveTelemetry(null));

    expect(result.current.status).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches the selected device immediately with no-store and an abort signal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(snapshot("rack/a1")));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useLiveTelemetry("rack/a1"));
    await settlePromises();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/devices/rack%2Fa1/live",
      expect.objectContaining({
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result.current.status).toBe("success");
    expect(result.current.data).toEqual(snapshot("rack/a1"));
  });

  it("polls 15 seconds after a request settles", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(snapshot("rack-a1")));
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useLiveTelemetry("rack-a1"));
    await settlePromises();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        LIVE_TELEMETRY_POLL_INTERVAL_MS - 1,
      );
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not overlap an unresolved request", async () => {
    vi.useFakeTimers();
    const firstRequest = deferred<Response>();
    const fetchMock = vi.fn().mockReturnValue(firstRequest.promise);
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useLiveTelemetry("rack-a1"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        LIVE_TELEMETRY_POLL_INTERVAL_MS * 3,
      );
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    firstRequest.resolve(jsonResponse(snapshot("rack-a1")));
    await settlePromises();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(LIVE_TELEMETRY_POLL_INTERVAL_MS);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("aborts an in-flight request on unmount", () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = renderHook(() => useLiveTelemetry("rack-a1"));
    const signal = (fetchMock.mock.calls[0]?.[1] as RequestInit)
      .signal as AbortSignal;

    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
  });

  it("aborts and invalidates the previous device request on selection change", async () => {
    const rackARequest = deferred<Response>();
    const rackBRequest = deferred<Response>();
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(rackARequest.promise)
      .mockReturnValueOnce(rackBRequest.promise);
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      ({ deviceId }) => useLiveTelemetry(deviceId),
      { initialProps: { deviceId: "rack-a1" as string | null } },
    );
    const rackASignal = (fetchMock.mock.calls[0]?.[1] as RequestInit)
      .signal as AbortSignal;

    rerender({ deviceId: "rack-b1" });

    expect(rackASignal.aborted).toBe(true);
    expect(result.current.deviceId).toBe("rack-b1");
    expect(result.current.status).toBe("loading");
    expect(result.current.data).toBeNull();

    rackBRequest.resolve(jsonResponse(snapshot("rack-b1", "metric-b")));
    await settlePromises();
    expect(result.current.data?.data.device.id).toBe("rack-b1");

    rackARequest.resolve(jsonResponse(snapshot("rack-a1", "metric-a")));
    await settlePromises();
    expect(result.current.data?.data.device.id).toBe("rack-b1");
  });

  it("retains the last snapshot after a background failure and recovers", async () => {
    vi.useFakeTimers();
    const first = snapshot("rack-a1", "metric-1");
    const recovered = snapshot("rack-a1", "metric-2");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(first))
      .mockResolvedValueOnce(jsonResponse({ error: {} }, 500))
      .mockResolvedValueOnce(jsonResponse(recovered));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useLiveTelemetry("rack-a1"));
    await settlePromises();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(LIVE_TELEMETRY_POLL_INTERVAL_MS);
    });
    expect(result.current.status).toBe("success");
    expect(result.current.data).toEqual(first);
    expect(result.current.refreshError).toMatch(/last successful snapshot/i);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(LIVE_TELEMETRY_POLL_INTERVAL_MS);
    });
    expect(result.current.data).toEqual(recovered);
    expect(result.current.refreshError).toBeNull();
  });

  it("recovers immediately when an initial error is retried", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: {} }, 500))
      .mockResolvedValueOnce(jsonResponse(snapshot("rack-a1")));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useLiveTelemetry("rack-a1"));
    await settlePromises();
    expect(result.current.status).toBe("error");

    act(() => result.current.retry());
    await settlePromises();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("success");
    expect(result.current.data?.data.device.id).toBe("rack-a1");
  });

  it("rejects a malformed or wrong-device response safely", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(snapshot("rack-b1")));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useLiveTelemetry("rack-a1"));
    await settlePromises();

    expect(result.current.status).toBe("error");
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe(
      "Unable to load telemetry for this device.",
    );
  });

  it("rejects metrics attributed to a different device", async () => {
    const payload = snapshot("rack-a1");
    payload.data.metrics[0] = {
      ...payload.data.metrics[0],
      deviceId: "rack-b1",
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useLiveTelemetry("rack-a1"));
    await settlePromises();

    expect(result.current.status).toBe("error");
    expect(result.current.data).toBeNull();
  });

  it("cleans up a scheduled poll after unmount", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(snapshot("rack-a1")));
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = renderHook(() => useLiveTelemetry("rack-a1"));
    await settlePromises();

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LIVE_TELEMETRY_POLL_INTERVAL_MS * 2);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
