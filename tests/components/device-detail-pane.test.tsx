// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeviceDetailPane } from "@/components/fleet-dashboard/device-detail-pane";
import { useLiveTelemetry } from "@/hooks/use-live-telemetry";
import type {
  FleetDeviceDto,
  LiveDeviceSnapshotResponse,
} from "@/lib/telemetry/contracts";

import "@/tests/frontend/setup";

vi.mock("@/hooks/use-live-telemetry", () => ({
  useLiveTelemetry: vi.fn(),
}));

vi.mock("@/components/fleet-dashboard/telemetry-chart", () => ({
  TelemetryChart: ({ metric }: { metric: string }) => (
    <div role="img" aria-label={`${metric} telemetry chart`} />
  ),
}));

const useLiveTelemetryMock = vi.mocked(useLiveTelemetry);
const retry = vi.fn();

const device: FleetDeviceDto = {
  id: "rack-a1",
  name: "Rack A1",
  location: "Data Hall A",
  createdAt: "2025-01-01T00:00:00.000Z",
  latestMetric: null,
};

function snapshot(
  overrides: Partial<LiveDeviceSnapshotResponse["data"]> = {},
): LiveDeviceSnapshotResponse {
  const metric = {
    id: "metric-1",
    deviceId: "rack-a1",
    power: 612,
    temperature: 77,
    recordedAt: "2025-10-09T13:59:55.000Z",
    receivedAt: "2025-10-09T13:59:56.000Z",
  };

  return {
    data: {
      device: { id: "rack-a1", name: "Rack A1", location: "Data Hall A" },
      latestMetric: metric,
      metrics: [metric],
      ...overrides,
    },
    meta: { asOf: "2025-10-09T14:00:00.000Z", windowSeconds: 60 },
  };
}

describe("DeviceDetailPane", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a purposeful empty selection state", () => {
    useLiveTelemetryMock.mockReturnValue({
      deviceId: null,
      status: "idle",
      data: null,
      error: null,
      refreshError: null,
      isRefreshing: false,
      retry,
    });

    render(<DeviceDetailPane device={null} isSelectionFilteredOut={false} />);

    expect(screen.getByText("Select a device")).toBeInTheDocument();
  });

  it("keeps device metadata visible during contained initial loading", () => {
    useLiveTelemetryMock.mockReturnValue({
      deviceId: "rack-a1",
      status: "loading",
      data: null,
      error: null,
      refreshError: null,
      isRefreshing: false,
      retry,
    });

    render(<DeviceDetailPane device={device} isSelectionFilteredOut={false} />);

    expect(screen.getByRole("heading", { name: "Rack A1" })).toBeInTheDocument();
    expect(screen.getByText(/rack-a1/)).toBeInTheDocument();
    expect(screen.getByText(/Data Hall A/)).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Loading selected-device telemetry" }),
    ).toBeInTheDocument();
  });

  it("renders latest values and separate power and temperature charts", () => {
    const data = snapshot();
    useLiveTelemetryMock.mockReturnValue({
      deviceId: "rack-a1",
      status: "success",
      data,
      error: null,
      refreshError: null,
      isRefreshing: false,
      retry,
    });

    render(<DeviceDetailPane device={device} isSelectionFilteredOut={false} />);

    expect(screen.getByText("612 W")).toBeInTheDocument();
    expect(screen.getByText("77 °F")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "power telemetry chart" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "temperature telemetry chart" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Auto-refreshing every 15s/)).toBeInTheDocument();
  });

  it("shows no telemetry without fabricating zero values", () => {
    const data = snapshot({ latestMetric: null, metrics: [] });
    useLiveTelemetryMock.mockReturnValue({
      deviceId: "rack-a1",
      status: "success",
      data,
      error: null,
      refreshError: null,
      isRefreshing: false,
      retry,
    });

    render(<DeviceDetailPane device={device} isSelectionFilteredOut={false} />);

    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.getByText("Never")).toBeInTheDocument();
    expect(screen.getByText("No telemetry received")).toBeInTheDocument();
    expect(screen.queryByText("0 W")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("distinguishes an empty current window from a never-reported device", () => {
    const data = snapshot({ metrics: [] });
    useLiveTelemetryMock.mockReturnValue({
      deviceId: "rack-a1",
      status: "success",
      data,
      error: null,
      refreshError: null,
      isRefreshing: false,
      retry,
    });

    render(<DeviceDetailPane device={device} isSelectionFilteredOut={false} />);

    expect(screen.getByText("612 W")).toBeInTheDocument();
    expect(
      screen.getByText("No telemetry in the current 60-second window"),
    ).toBeInTheDocument();
    expect(screen.queryByText("No telemetry received")).not.toBeInTheDocument();
  });

  it("retains data and displays a restrained background refresh warning", () => {
    useLiveTelemetryMock.mockReturnValue({
      deviceId: "rack-a1",
      status: "success",
      data: snapshot(),
      error: null,
      refreshError:
        "The latest refresh failed. Showing the last successful snapshot.",
      isRefreshing: false,
      retry,
    });

    render(<DeviceDetailPane device={device} isSelectionFilteredOut={true} />);

    expect(screen.getByText("612 W")).toBeInTheDocument();
    expect(screen.getByText(/last successful snapshot/i)).toBeInTheDocument();
    expect(screen.getByText(/outside the current fleet filters/i)).toBeInTheDocument();
  });

  it("shows a neutral in-progress label during a background refresh", () => {
    useLiveTelemetryMock.mockReturnValue({
      deviceId: "rack-a1",
      status: "success",
      data: snapshot(),
      error: null,
      refreshError: null,
      isRefreshing: true,
      retry,
    });

    render(<DeviceDetailPane device={device} isSelectionFilteredOut={false} />);

    expect(screen.getByText("Refreshing snapshot…")).toBeInTheDocument();
    expect(screen.getByText("612 W")).toBeInTheDocument();
  });

  it("shows a contained initial error and retries on demand", async () => {
    const user = userEvent.setup();
    useLiveTelemetryMock.mockReturnValue({
      deviceId: "rack-a1",
      status: "error",
      data: null,
      error: "Unable to load telemetry for this device.",
      refreshError: null,
      isRefreshing: false,
      retry,
    });

    render(<DeviceDetailPane device={device} isSelectionFilteredOut={false} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Device telemetry is temporarily unavailable",
    );
    await user.click(
      screen.getByRole("button", { name: "Retry device request" }),
    );
    expect(retry).toHaveBeenCalledOnce();
  });
});
