"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  FleetDevicesResponse,
} from "@/lib/telemetry/contracts";
import { isFleetDevicesResponse } from "@/lib/telemetry/contract-validation";

type FleetDevicesState =
  | {
      status: "loading";
      data: null;
      error: null;
      refreshError: null;
      isRefreshing: false;
    }
  | {
      status: "success";
      data: FleetDevicesResponse;
      error: null;
      refreshError: string | null;
      isRefreshing: boolean;
    }
  | {
      status: "error";
      data: null;
      error: string;
      refreshError: null;
      isRefreshing: false;
    };

export const FLEET_POLL_INTERVAL_MS = 15_000;

const INITIAL_STATE: FleetDevicesState = {
  status: "loading",
  data: null,
  error: null,
  refreshError: null,
  isRefreshing: false,
};

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function useFleetDevices() {
  const [state, setState] = useState<FleetDevicesState>(INITIAL_STATE);
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;
    let pollTimeout: ReturnType<typeof setTimeout> | null = null;
    let requestInFlight = false;

    async function loadFleet() {
      if (!isActive || requestInFlight) {
        return;
      }

      requestInFlight = true;
      setState((current) =>
        current.data === null
          ? current
          : { ...current, isRefreshing: true, refreshError: null },
      );

      try {
        const response = await fetch("/api/devices", {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Fleet request failed.");
        }

        const payload: unknown = await response.json();

        if (!isFleetDevicesResponse(payload)) {
          throw new Error("Fleet response was invalid.");
        }

        if (isActive) {
          setState({
            status: "success",
            data: payload,
            error: null,
            refreshError: null,
            isRefreshing: false,
          });
        }
      } catch (error) {
        if (!isActive || isAbortError(error)) {
          return;
        }

        setState((current) => {
          if (current.data !== null) {
            return {
              ...current,
              status: "success",
              error: null,
              refreshError:
                "Fleet refresh failed. Showing the last successful snapshot.",
              isRefreshing: false,
            };
          }

          return {
            status: "error",
            data: null,
            error: "Unable to load fleet telemetry. Try the request again.",
            refreshError: null,
            isRefreshing: false,
          };
        });
      } finally {
        requestInFlight = false;

        if (isActive) {
          pollTimeout = setTimeout(
            () => void loadFleet(),
            FLEET_POLL_INTERVAL_MS,
          );
        }
      }
    }

    void loadFleet();

    return () => {
      isActive = false;
      if (pollTimeout !== null) {
        clearTimeout(pollTimeout);
      }
      controller.abort();
    };
  }, [requestVersion]);

  const retry = useCallback(() => {
    setState(INITIAL_STATE);
    setRequestVersion((version) => version + 1);
  }, []);

  return { ...state, retry };
}
