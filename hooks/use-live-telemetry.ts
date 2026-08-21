"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { isLiveDeviceSnapshotResponse } from "@/lib/telemetry/contract-validation";
import type { LiveDeviceSnapshotResponse } from "@/lib/telemetry/contracts";
import { LIVE_TELEMETRY_POLL_INTERVAL_MS } from "@/lib/telemetry/live-telemetry";

type LiveTelemetryStatus = "idle" | "loading" | "success" | "error";

type LiveTelemetryState = {
  deviceId: string | null;
  status: LiveTelemetryStatus;
  data: LiveDeviceSnapshotResponse | null;
  error: string | null;
  refreshError: string | null;
  isRefreshing: boolean;
};

const IDLE_STATE: LiveTelemetryState = {
  deviceId: null,
  status: "idle",
  data: null,
  error: null,
  refreshError: null,
  isRefreshing: false,
};

function createLoadingState(deviceId: string): LiveTelemetryState {
  return {
    deviceId,
    status: "loading",
    data: null,
    error: null,
    refreshError: null,
    isRefreshing: false,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function useLiveTelemetry(deviceId: string | null) {
  const [state, setState] = useState<LiveTelemetryState>(IDLE_STATE);
  const [retryVersion, setRetryVersion] = useState(0);
  const generationRef = useRef(0);

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;

    if (deviceId === null) {
      return;
    }

    const requestedDeviceId = deviceId;

    let disposed = false;
    let activeController: AbortController | null = null;
    let pollTimeout: ReturnType<typeof setTimeout> | null = null;

    async function requestSnapshot() {
      if (disposed || activeController !== null) {
        return;
      }

      const controller = new AbortController();
      activeController = controller;

      setState((current) => {
        if (current.deviceId !== requestedDeviceId || current.data === null) {
          return current;
        }

        return {
          ...current,
          isRefreshing: true,
          refreshError: null,
        };
      });

      try {
        const response = await fetch(
          `/api/devices/${encodeURIComponent(requestedDeviceId)}/live`,
          {
            cache: "no-store",
            headers: { Accept: "application/json" },
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error("Live telemetry request failed.");
        }

        const payload: unknown = await response.json();

        if (
          !isLiveDeviceSnapshotResponse(payload) ||
          payload.data.device.id !== requestedDeviceId
        ) {
          throw new Error("Live telemetry response was invalid.");
        }

        if (disposed || generationRef.current !== generation) {
          return;
        }

        setState({
          deviceId: requestedDeviceId,
          status: "success",
          data: payload,
          error: null,
          refreshError: null,
          isRefreshing: false,
        });
      } catch (error) {
        if (
          disposed ||
          generationRef.current !== generation ||
          isAbortError(error)
        ) {
          return;
        }

        setState((current) => {
          if (
            current.deviceId === requestedDeviceId &&
            current.data !== null
          ) {
            return {
              ...current,
              status: "success",
              error: null,
              refreshError:
                "The latest refresh failed. Showing the last successful snapshot.",
              isRefreshing: false,
            };
          }

          return {
            deviceId: requestedDeviceId,
            status: "error",
            data: null,
            error: "Unable to load telemetry for this device.",
            refreshError: null,
            isRefreshing: false,
          };
        });
      } finally {
        if (activeController === controller) {
          activeController = null;
        }

        if (!disposed && generationRef.current === generation) {
          pollTimeout = setTimeout(
            () => void requestSnapshot(),
            LIVE_TELEMETRY_POLL_INTERVAL_MS,
          );
        }
      }
    }

    void requestSnapshot();

    return () => {
      disposed = true;

      if (generationRef.current === generation) {
        generationRef.current += 1;
      }

      if (pollTimeout !== null) {
        clearTimeout(pollTimeout);
      }

      activeController?.abort();
    };
  }, [deviceId, retryVersion]);

  const retry = useCallback(() => {
    if (deviceId !== null) {
      setState(createLoadingState(deviceId));
    }

    setRetryVersion((version) => version + 1);
  }, [deviceId]);

  const visibleState =
    state.deviceId === deviceId
      ? state
      : deviceId === null
        ? IDLE_STATE
        : createLoadingState(deviceId);

  return { ...visibleState, retry };
}
