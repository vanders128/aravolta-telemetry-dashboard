"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  FleetDeviceDto,
  FleetDevicesResponse,
  MetricDto,
} from "@/lib/telemetry/contracts";

type FleetDevicesState =
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: FleetDevicesResponse; error: null }
  | { status: "error"; data: null; error: string };

const INITIAL_STATE: FleetDevicesState = {
  status: "loading",
  data: null,
  error: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isMetricDto(value: unknown): value is MetricDto {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.deviceId === "string" &&
    typeof value.power === "number" &&
    Number.isFinite(value.power) &&
    typeof value.temperature === "number" &&
    Number.isFinite(value.temperature) &&
    typeof value.recordedAt === "string" &&
    typeof value.receivedAt === "string"
  );
}

function isFleetDeviceDto(value: unknown): value is FleetDeviceDto {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.location === null || typeof value.location === "string") &&
    typeof value.createdAt === "string" &&
    (value.latestMetric === null || isMetricDto(value.latestMetric))
  );
}

function isFleetDevicesResponse(value: unknown): value is FleetDevicesResponse {
  if (!isRecord(value) || !isRecord(value.data) || !isRecord(value.meta)) {
    return false;
  }

  return (
    Array.isArray(value.data.devices) &&
    value.data.devices.every(isFleetDeviceDto) &&
    typeof value.meta.asOf === "string"
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function useFleetDevices() {
  const [state, setState] = useState<FleetDevicesState>(INITIAL_STATE);
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function loadFleet() {
      setState(INITIAL_STATE);

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
          setState({ status: "success", data: payload, error: null });
        }
      } catch (error) {
        if (!isActive || isAbortError(error)) {
          return;
        }

        setState({
          status: "error",
          data: null,
          error: "Unable to load fleet telemetry. Try the request again.",
        });
      }
    }

    void loadFleet();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [requestVersion]);

  const retry = useCallback(() => {
    setRequestVersion((version) => version + 1);
  }, []);

  return { ...state, retry };
}
