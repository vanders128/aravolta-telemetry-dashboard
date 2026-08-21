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
- Repeatable development seed data covering varied telemetry and a no-data device
- A validated telemetry ingestion endpoint backed by durable PostgreSQL writes
- Device, recent-metric, and full live-snapshot query endpoints

Dashboard features and the complete architecture documentation will be added incrementally in subsequent phases.

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

Alert and reporting-state fields will be added with the centralized demonstration rules in a later phase; the query layer does not invent placeholder status values.

## Database model

- `Device` is the stable registry of known assets.
- `Metric` stores timestamped power and temperature readings for one device.
- `recordedAt` is the time reported by the device.
- `receivedAt` is the time the ingestion system received the reading.
- The `(deviceId, recordedAt DESC)` index supports recent-history and latest-reading lookups for a device.

The seed only replaces metrics belonging to its documented demo device IDs. It does not truncate either table or modify unrelated devices.

The finalized README will include migrations, seed data, simulator usage, API contracts, architecture, scaling analysis, tradeoffs, and test instructions once those features exist.
