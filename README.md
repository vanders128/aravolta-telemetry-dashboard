# Aravolta Telemetry Dashboard

A full-stack device telemetry dashboard built as a Senior Software Engineer take-home project for Aravolta.

The application will ingest and persist device power and temperature readings, present fleet-level operational status, and provide a live 60-second telemetry view for a selected device.

## Current status

The project currently includes:

- Next.js App Router, React, and strict TypeScript
- ESLint and production-build checks
- PostgreSQL local-development configuration
- Prisma, Zod, Recharts, and focused testing dependencies
- A migrated Device and Metric schema
- Repeatable 12-device demo fleet covering normal, warning, critical, stale, and no-data states
- A validated telemetry ingestion endpoint backed by durable PostgreSQL writes
- Device, recent-metric, and full live-snapshot query endpoints
- A responsive fleet dashboard backed exclusively by the device query API
- A selected-device workspace with polling and separate power and temperature charts
- Derived alert/freshness status, combined fleet filters, and a real-API telemetry simulator

The complete architecture and scaling documentation will be added in a subsequent phase.

## Local prerequisites

- Node.js 20.19+, 22.12+, or 24+
- npm
- Docker with Docker Compose, or a compatible PostgreSQL instance

## Foundation commands

```bash
npm install
cp .env.example .env
docker compose up -d
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

Open [http://localhost:3000](http://localhost:3000).

With the application running, start the explicit demo simulator in another terminal:

```bash
npm run simulate
```

Quality checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Telemetry ingestion

`POST /api/metrics` accepts a JSON body with `deviceId`, finite numeric `power` and `temperature` values, and a timezone-aware ISO 8601 `timestamp`.

```json
{
  "deviceId": "rack-a1",
  "power": 612,
  "temperature": 77,
  "timestamp": "2025-10-09T14:00:00Z"
}
```

A successful request returns `201 Created` with the persisted metric under `data`. Its database `BigInt` ID is represented as a decimal string, and both timestamps are ISO strings. Unknown device IDs are deliberately rejected with `404 DEVICE_NOT_FOUND`; ingestion never creates devices implicitly. Malformed JSON returns `400`, valid JSON that fails schema validation returns `422`, and unexpected persistence failures return a sanitized `500` response.

The route waits for the Prisma insert to complete before returning `201`. This keeps acknowledgement tied to a durable PostgreSQL write without introducing a queue for the take-home scope.

## Telemetry queries

- `GET /api/devices` returns every device with its latest metric, or `null` for devices that have never reported.
- `GET /api/devices/:id/metrics?windowSeconds=60` returns chronologically ordered metrics in a recent event-time window. The window defaults to 60 seconds and accepts positive integer values up to 3600.
- `GET /api/devices/:id/live` returns a complete 60-second snapshot plus the device's latest known metric for simple polling.

Recent windows use `recordedAt` because charts represent when a device produced each reading. `receivedAt` remains available to inspect ingestion delay. All query responses use `Cache-Control: no-store` so polling cannot reuse stale telemetry.

Alert and reporting-state fields are intentionally not persisted or added to the query DTOs. The client derives them from the latest metric and the response snapshot time using the centralized demonstration configuration.

## Fleet dashboard

The fleet view fetches `GET /api/devices` immediately and then approximately every 15 seconds using completion-based polling, so requests cannot overlap. A background failure retains the last successful fleet snapshot and a later successful poll recovers automatically. Summary cards cover total devices, normal/current devices, warning or critical devices needing attention, stale/no-data devices, and aggregate power from current telemetry only. Search matches device name, ID, and location; location and status filters combine with search using AND semantics. Fleet ordering remains the stable API order during refreshes.

The first fleet device is selected initially, and choosing another row updates a persistent device-detail workspace. The client fetches `GET /api/devices/:id/live` immediately and then approximately every 15 seconds. Each successful response replaces the prior chart snapshot in full, using the server's 60-second `recordedAt` event-time window; snapshots are never merged into an accumulating client history. At the chart boundary, `recordedAt` maps explicitly to the assignment-facing `timestamp` field. Separate power and temperature charts show raw readings and an inclusive, time-based 10-second rolling average, so irregular reporting intervals are handled without assuming a fixed sample count.

### Demonstration alert and freshness assumptions

The assignment does not define telemetry units or alert limits. For demonstration, the UI presents power in watts and temperature in degrees Fahrenheit (inferred from the sample value of 77). Current readings are classified using these inclusive boundaries:

- Temperature: warning at `85 °F`, critical at `95 °F`
- Power: warning at `1000 W`, critical at `1250 W`

Telemetry is current through exactly 45 seconds of event-time age and stale above 45 seconds. Freshness uses `recordedAt` because the operator view asks whether the measurement itself represents current device state. `receivedAt` remains ingestion metadata; a production system may additionally use it to classify transport/reporting freshness.

Measurement severity and freshness remain separate. The final visible precedence is **No Data → Stale → Critical → Warning → Normal**, so an old healthy value is not presented as current health. All units, thresholds, and freshness values are centralized in `lib/telemetry/config.ts`; none are encoded in the database schema.

Charts include compact warning and critical reference lines while keeping raw readings and the 10-second rolling average visually dominant.

## Demo fleet and simulator

The deterministic seed manages only its 12 known IDs: Rack A1/A2/A3, Rack B1/B2, Rack C1, UPS 01/02, Cooling Unit 01/02, and PDU A1/B1 across Data Halls A–C, the Power Room, and the Mechanical Room. Re-running the seed replaces telemetry only for those known demo IDs and never truncates unrelated data.

`npm run simulate` sends bounded, gradual telemetry updates about every five seconds through the real `POST /api/metrics` ingestion route. Set `TELEMETRY_API_BASE_URL` to override its default `http://localhost:3000` target. The process is developer-started, stops with Ctrl+C, and never writes directly to Prisma.

The profiles intentionally keep these states reproducible:

- Normal: Rack A1/A2/A3, Rack B1, UPS 02, Cooling Unit 01/02, and PDU A1
- Warning: UPS 01 (`1050–1150 W`, `86–92 °F`)
- Critical: Rack B2 (`1260–1350 W`, `96–99 °F`)
- Stale: PDU B1 has an older last-known seed reading and is excluded from simulation
- No Data: Rack C1 has no seed metrics and is excluded from simulation

## Database model

- `Device` is the stable registry of known assets.
- `Metric` stores timestamped power and temperature readings for one device.
- `recordedAt` is the time reported by the device.
- `receivedAt` is the time the ingestion system received the reading.
- The `(deviceId, recordedAt DESC)` index supports recent-history and latest-reading lookups for a device.

The seed only replaces metrics belonging to its documented demo device IDs. It does not truncate either table or modify unrelated devices.

The finalized README will add the full architecture, scaling analysis, tradeoffs, and operational hardening discussion in a later phase.
