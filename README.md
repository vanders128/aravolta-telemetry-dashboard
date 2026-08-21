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

APIs, dashboard features, tests, and the complete architecture documentation will be added incrementally in subsequent phases.

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
npm run build
```

## Database model

- `Device` is the stable registry of known assets.
- `Metric` stores timestamped power and temperature readings for one device.
- `recordedAt` is the time reported by the device.
- `receivedAt` is the time the ingestion system received the reading.
- The `(deviceId, recordedAt DESC)` index supports recent-history and latest-reading lookups for a device.

The seed only replaces metrics belonging to its documented demo device IDs. It does not truncate either table or modify unrelated devices.

The finalized README will include migrations, seed data, simulator usage, API contracts, architecture, scaling analysis, tradeoffs, and test instructions once those features exist.
