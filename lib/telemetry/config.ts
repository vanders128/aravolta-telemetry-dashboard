// The assignment does not specify units, alert limits, or freshness limits.
// These centralized values are demonstration assumptions so production domain
// policy can replace them without changing persistence or API contracts.
export const TELEMETRY_CONFIG = {
  display: {
    power: {
      label: "Power",
      unitName: "watts",
      unitSymbol: "W",
    },
    temperature: {
      label: "Temperature",
      unitName: "degrees Fahrenheit",
      unitSymbol: "°F",
    },
  },
  thresholds: {
    power: {
      warning: 1_000,
      critical: 1_250,
    },
    temperature: {
      warning: 85,
      critical: 95,
    },
  },
  freshnessThresholdSeconds: 45,
} as const;

export const TELEMETRY_DISPLAY_CONFIG = TELEMETRY_CONFIG.display;
export const TELEMETRY_THRESHOLDS = TELEMETRY_CONFIG.thresholds;
export const FRESHNESS_THRESHOLD_SECONDS =
  TELEMETRY_CONFIG.freshnessThresholdSeconds;
