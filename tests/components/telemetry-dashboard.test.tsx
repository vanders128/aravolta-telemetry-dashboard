// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TelemetryDashboard } from "@/components/fleet-dashboard/telemetry-dashboard";
import { useFleetDevices } from "@/hooks/use-fleet-devices";
import type {
  FleetDeviceDto,
  FleetDevicesResponse,
} from "@/lib/telemetry/contracts";

import "@/tests/frontend/setup";

vi.mock("@/hooks/use-fleet-devices", () => ({
  useFleetDevices: vi.fn(),
}));

vi.mock("@/components/fleet-dashboard/device-detail-pane", () => ({
  DeviceDetailPane: ({
    device,
    isSelectionFilteredOut,
  }: {
    device: FleetDeviceDto | null;
    isSelectionFilteredOut: boolean;
  }) => (
    <aside
      data-testid="device-detail"
      data-device-id={device?.id ?? ""}
      data-filtered-out={String(isSelectionFilteredOut)}
    />
  ),
}));

const useFleetDevicesMock = vi.mocked(useFleetDevices);
const retry = vi.fn();

function device(
  id: string,
  overrides: Partial<FleetDeviceDto> = {},
): FleetDeviceDto {
  return {
    id,
    name: `Rack ${id.toUpperCase()}`,
    location: "Data Hall A",
    createdAt: "2025-01-01T00:00:00.000Z",
    latestMetric: {
      id: `metric-${id}`,
      deviceId: id,
      power: 612,
      temperature: 77,
      recordedAt: "2025-10-09T13:59:55.000Z",
      receivedAt: "2025-10-09T13:59:56.000Z",
    },
    ...overrides,
  };
}

function response(devices: FleetDeviceDto[]): FleetDevicesResponse {
  return {
    data: { devices },
    meta: { asOf: "2025-10-09T14:00:00.000Z" },
  };
}

function mockSuccess(devices: FleetDeviceDto[]) {
  useFleetDevicesMock.mockReturnValue({
    status: "success",
    data: response(devices),
    error: null,
    retry,
  });
}

describe("TelemetryDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a deliberate loading state before fleet data is available", () => {
    useFleetDevicesMock.mockReturnValue({
      status: "loading",
      data: null,
      error: null,
      retry,
    });

    render(<TelemetryDashboard />);

    expect(
      screen.getByRole("status", { name: "Loading fleet telemetry" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows a safe request error and provides retry", async () => {
    const user = userEvent.setup();
    useFleetDevicesMock.mockReturnValue({
      status: "error",
      data: null,
      error: "Unable to load fleet telemetry. Try the request again.",
      retry,
    });

    render(<TelemetryDashboard />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Telemetry is temporarily unavailable",
    );
    await user.click(screen.getByRole("button", { name: "Retry request" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("distinguishes an empty fleet from filtered results", () => {
    mockSuccess([]);

    render(<TelemetryDashboard />);

    expect(screen.getByText("No devices registered")).toBeInTheDocument();
    expect(
      screen.queryByText("No devices match these filters"),
    ).not.toBeInTheDocument();
  });

  it("renders fleet summaries, telemetry rows, zero values, and missing data", () => {
    mockSuccess([
      device("rack-a1", { name: "Primary rack" }),
      device("rack-b1", {
        name: "Idle rack",
        location: "Data Hall B",
        latestMetric: {
          id: "metric-rack-b1",
          deviceId: "rack-b1",
          power: 0,
          temperature: 70,
          recordedAt: "2025-10-09T13:59:50.000Z",
          receivedAt: "2025-10-09T13:59:51.000Z",
        },
      }),
      device("rack-c1", {
        name: "New rack",
        location: null,
        latestMetric: null,
      }),
    ]);

    render(<TelemetryDashboard />);

    const summaryRegion = screen.getByRole("region", {
      name: "Fleet summary",
    });
    expect(within(summaryRegion).getByText("Total devices")).toBeInTheDocument();
    expect(
      within(summaryRegion).getByText("Devices with telemetry"),
    ).toBeInTheDocument();
    expect(within(summaryRegion).getByText("612 W")).toBeInTheDocument();
    expect(within(summaryRegion).getByText("73.5 °F")).toBeInTheDocument();

    const table = screen.getByRole("table");
    const primaryRow = within(table).getByText("Primary rack").closest("tr");
    const idleRow = within(table).getByText("Idle rack").closest("tr");
    const newRow = within(table).getByText("New rack").closest("tr");

    expect(primaryRow).not.toBeNull();
    expect(within(primaryRow!).getByText("612 W")).toBeInTheDocument();
    expect(idleRow).not.toBeNull();
    expect(within(idleRow!).getByText("0 W")).toBeInTheDocument();
    expect(newRow).not.toBeNull();
    expect(within(newRow!).getByText("Unassigned")).toBeInTheDocument();
    expect(
      within(newRow!).getByRole("cell", { name: "No power reading" }),
    ).toHaveTextContent("—");
    expect(
      within(newRow!).getByRole("cell", { name: "No temperature reading" }),
    ).toHaveTextContent("—");
    expect(within(newRow!).getByText("Never")).toBeInTheDocument();
    expect(
      within(newRow!).getByText("No telemetry received"),
    ).toBeInTheDocument();
    expect(within(newRow!).queryByText("0 W")).not.toBeInTheDocument();
  });

  it("searches name, ID, and location and combines search with filtering", async () => {
    const user = userEvent.setup();
    mockSuccess([
      device("rack-a1", { name: "Alpha rack", location: "North plant" }),
      device("rack-b1", { name: "Beta rack", location: "South plant" }),
      device("rack-c1", { name: "Gamma rack", location: null }),
    ]);

    render(<TelemetryDashboard />);

    const search = screen.getByRole("searchbox", { name: "Search devices" });
    const location = screen.getByRole("combobox", { name: "Location" });

    await user.type(search, "rack-b1");
    expect(screen.getByText("Beta rack")).toBeInTheDocument();
    expect(screen.queryByText("Alpha rack")).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "south");
    expect(screen.getByText("Beta rack")).toBeInTheDocument();

    await user.clear(search);
    await user.selectOptions(location, "location:North plant");
    expect(screen.getByText("Alpha rack")).toBeInTheDocument();
    expect(screen.queryByText("Beta rack")).not.toBeInTheDocument();

    const fleetSummary = screen.getByRole("region", { name: "Fleet summary" });
    const totalCard = within(fleetSummary).getByText("Total devices").closest("div");
    expect(totalCard).not.toBeNull();
    expect(within(totalCard!).getByText("3")).toBeInTheDocument();

    await user.type(search, "beta");
    expect(
      screen.getByText("No devices match these filters"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("Alpha rack")).toBeInTheDocument();
    expect(screen.getByText("Beta rack")).toBeInTheDocument();
    expect(screen.getByText("Gamma rack")).toBeInTheDocument();
  });

  it("selects the first device initially and changes selection accessibly", async () => {
    const user = userEvent.setup();
    mockSuccess([
      device("rack-a1", { name: "Alpha rack" }),
      device("rack-b1", { name: "Beta rack" }),
    ]);

    render(<TelemetryDashboard />);

    const table = screen.getByRole("table");
    const alphaButton = within(table).getByRole("button", {
      name: /Alpha rack/i,
    });
    const betaButton = within(table).getByRole("button", {
      name: /Beta rack/i,
    });
    const detail = screen.getByTestId("device-detail");

    expect(alphaButton).toHaveAttribute("aria-current", "true");
    expect(alphaButton.closest("tr")).toHaveAttribute("data-selected", "true");
    expect(detail).toHaveAttribute("data-device-id", "rack-a1");

    betaButton.focus();
    await user.keyboard("{Enter}");

    expect(alphaButton).not.toHaveAttribute("aria-current");
    expect(betaButton).toHaveAttribute("aria-current", "true");
    expect(betaButton.closest("tr")).toHaveAttribute("data-selected", "true");
    expect(detail).toHaveAttribute("data-device-id", "rack-b1");
  });

  it("retains a selected device when filters hide its row", async () => {
    const user = userEvent.setup();
    mockSuccess([
      device("rack-a1", { name: "Alpha rack", location: "North plant" }),
      device("rack-b1", { name: "Beta rack", location: "South plant" }),
    ]);

    render(<TelemetryDashboard />);

    await user.click(
      within(screen.getByRole("table")).getByRole("button", {
        name: /Beta rack/i,
      }),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Location" }),
      "location:North plant",
    );

    expect(screen.queryByText("Beta rack")).not.toBeInTheDocument();
    expect(screen.getByTestId("device-detail")).toHaveAttribute(
      "data-device-id",
      "rack-b1",
    );
    expect(screen.getByTestId("device-detail")).toHaveAttribute(
      "data-filtered-out",
      "true",
    );
  });
});
