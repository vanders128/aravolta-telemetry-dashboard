# Aravolta Telemetry Dashboard

A full-stack device telemetry dashboard built as a Senior Software Engineer take-home project for Aravolta.

The application will ingest and persist device power and temperature readings, present fleet-level operational status, and provide a live 60-second telemetry view for a selected device.

## Current status

Phase 1 establishes the application foundation:

- Next.js App Router, React, and strict TypeScript
- ESLint and production-build checks
- PostgreSQL local-development configuration
- Prisma, Zod, Recharts, and focused testing dependencies

Database models, APIs, dashboard features, tests, and the complete architecture documentation will be added incrementally in subsequent phases.

## Local prerequisites

- Node.js 20.19+, 22.12+, or 24+
- npm
- Docker with Docker Compose, or a compatible PostgreSQL instance

## Foundation commands

```bash
npm install
docker compose up -d
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Quality checks:

```bash
npm run lint
npm run typecheck
npm run build
```

The finalized README will include migrations, seed data, simulator usage, API contracts, architecture, scaling analysis, tradeoffs, and test instructions once those features exist.
