import { TELEMETRY_DISPLAY_CONFIG } from "@/lib/telemetry/config";

const measurementFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "short",
  second: "2-digit",
  timeZoneName: "short",
  year: "numeric",
});

export function formatPower(value: number): string {
  return `${measurementFormatter.format(value)} ${TELEMETRY_DISPLAY_CONFIG.power.unitSymbol}`;
}

export function formatTemperature(value: number): string {
  return `${measurementFormatter.format(value)} ${TELEMETRY_DISPLAY_CONFIG.temperature.unitSymbol}`;
}

export function formatTimestamp(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Unavailable"
    : timestampFormatter.format(date);
}
