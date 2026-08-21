// @vitest-environment jsdom

import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TelemetryChart } from "@/components/fleet-dashboard/telemetry-chart";
import type { RollingTelemetryPoint } from "@/lib/telemetry/contracts";

import "@/tests/frontend/setup";

vi.mock("recharts", () => ({
  CartesianGrid: () => null,
  Legend: () => null,
  Line: ({
    dataKey,
    isAnimationActive,
    name,
    type,
  }: {
    dataKey: string;
    isAnimationActive: boolean;
    name: string;
    type: string;
  }) => (
    <span
      data-testid={`line-${dataKey}`}
      data-animation={String(isAnimationActive)}
      data-name={name}
      data-type={type}
    />
  ),
  LineChart: ({
    accessibilityLayer,
    children,
    desc,
    title,
  }: {
    accessibilityLayer: boolean;
    children: ReactNode;
    desc: string;
    title: string;
  }) => (
    <div
      role="img"
      aria-label={title}
      data-accessibility-layer={String(accessibilityLayer)}
      data-description={desc}
    >
      {children}
    </div>
  ),
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  ReferenceLine: ({
    label,
    y,
  }: {
    label: { value: string };
    y: number;
  }) => (
    <span
      data-testid={`threshold-${y}`}
      data-label={label.value}
    />
  ),
  Tooltip: () => null,
  XAxis: ({ domain }: { domain: [number, number] }) => (
    <span data-testid="time-axis" data-domain={JSON.stringify(domain)} />
  ),
  YAxis: () => null,
}));

const points: RollingTelemetryPoint[] = [
  {
    power: 600,
    temperature: 75,
    timestamp: "2025-10-09T13:59:50.000Z",
    timestampMs: Date.parse("2025-10-09T13:59:50.000Z"),
    powerRollingAverage: 590,
    temperatureRollingAverage: 74,
  },
  {
    power: 620,
    temperature: 77,
    timestamp: "2025-10-09T14:00:00.000Z",
    timestampMs: Date.parse("2025-10-09T14:00:00.000Z"),
    powerRollingAverage: 610,
    temperatureRollingAverage: 76,
  },
];

describe("TelemetryChart", () => {
  it("wires raw and rolling power series to a fixed event-time domain", () => {
    const windowStartMs = Date.parse("2025-10-09T13:59:00.000Z");
    const windowEndMs = Date.parse("2025-10-09T14:00:00.000Z");

    render(
      <TelemetryChart
        metric="power"
        points={points}
        windowStartMs={windowStartMs}
        windowEndMs={windowEndMs}
      />,
    );

    expect(screen.getByRole("heading", { name: "Power" })).toBeInTheDocument();
    expect(screen.getByText("watts")).toBeInTheDocument();
    expect(screen.getByText("620 W")).toBeInTheDocument();
    expect(screen.getByText("610 W")).toBeInTheDocument();

    const chart = screen.getByRole("img", {
      name: "Power telemetry chart",
    });
    expect(chart).toHaveAttribute("data-accessibility-layer", "true");
    expect(chart).toHaveAttribute(
      "data-description",
      expect.stringContaining("last 60 seconds"),
    );
    expect(screen.getByTestId("time-axis")).toHaveAttribute(
      "data-domain",
      JSON.stringify([windowStartMs, windowEndMs]),
    );
    expect(screen.getByTestId("line-power")).toHaveAttribute(
      "data-animation",
      "false",
    );
    expect(screen.getByTestId("line-power")).toHaveAttribute(
      "data-type",
      "linear",
    );
    expect(screen.getByTestId("line-powerRollingAverage")).toHaveAttribute(
      "data-name",
      "10s average",
    );
    expect(screen.getByTestId("threshold-1000")).toHaveAttribute(
      "data-label",
      "Warning 1,000 W",
    );
    expect(screen.getByTestId("threshold-1250")).toHaveAttribute(
      "data-label",
      "Critical 1,250 W",
    );
  });

  it("uses an independent temperature series and unit context", () => {
    render(
      <TelemetryChart
        metric="temperature"
        points={points}
        windowStartMs={Date.parse("2025-10-09T13:59:00.000Z")}
        windowEndMs={Date.parse("2025-10-09T14:00:00.000Z")}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Temperature" }),
    ).toBeInTheDocument();
    expect(screen.getByText("degrees Fahrenheit")).toBeInTheDocument();
    expect(screen.getByText("77 °F")).toBeInTheDocument();
    expect(screen.getByText("76 °F")).toBeInTheDocument();
    expect(screen.getByTestId("line-temperature")).toBeInTheDocument();
    expect(
      screen.getByTestId("line-temperatureRollingAverage"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("threshold-85")).toHaveAttribute(
      "data-label",
      "Warning 85 °F",
    );
    expect(screen.getByTestId("threshold-95")).toHaveAttribute(
      "data-label",
      "Critical 95 °F",
    );
  });
});
