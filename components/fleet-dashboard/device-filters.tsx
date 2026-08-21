import type {
  LocationFilterValue,
  LocationOption,
} from "@/lib/telemetry/fleet-dashboard";

import styles from "./telemetry-dashboard.module.css";

type DeviceFiltersProps = {
  query: string;
  locationFilter: LocationFilterValue;
  locationOptions: LocationOption[];
  visibleCount: number;
  totalCount: number;
  filtersAreActive: boolean;
  onQueryChange: (query: string) => void;
  onLocationChange: (location: LocationFilterValue) => void;
  onClear: () => void;
};

export function DeviceFilters({
  query,
  locationFilter,
  locationOptions,
  visibleCount,
  totalCount,
  filtersAreActive,
  onQueryChange,
  onLocationChange,
  onClear,
}: DeviceFiltersProps) {
  return (
    <div className={styles.filterBar}>
      <div className={styles.filterControls}>
        <label className={styles.field}>
          <span>Search devices</span>
          <input
            type="search"
            value={query}
            placeholder="Name, ID, or location"
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>Location</span>
          <select
            value={locationFilter}
            onChange={(event) =>
              onLocationChange(event.target.value as LocationFilterValue)
            }
          >
            {locationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {filtersAreActive ? (
          <button className={styles.clearButton} type="button" onClick={onClear}>
            Clear filters
          </button>
        ) : null}
      </div>

      <p className={styles.resultCount} aria-live="polite">
        Showing {visibleCount.toLocaleString("en-US")} of{" "}
        {totalCount.toLocaleString("en-US")} devices
      </p>
    </div>
  );
}
