// The assignment does not specify display units. These presentation-only
// assumptions are centralized so they can be changed without touching data or
// domain models.
export const TELEMETRY_DISPLAY_CONFIG = {
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
} as const;
