# Aravolta Live Device Telemetry Dashboard

A full-stack dashboard and API for ingesting, persisting, and monitoring power and temperature telemetry from registered data-center devices. The project implements a complete local vertical slice and documents how its intentionally simple architecture would evolve under production-scale load.

## Features

- Validated `POST /api/metrics` telemetry ingestion with durable PostgreSQL persistence
- Fleet API with each registered device's latest reading
- Configurable recent metric history and a live 60-second device snapshot
- Fleet search by name, ID, or location plus location and status filters
- Operational summaries for device state and current aggregate power
- Completion-based fleet and selected-device polling
- Separate power and temperature charts with 10-second rolling averages
- Derived Normal, Warning, Critical, Stale, and No Data states
- Deterministic 12-device seed and bounded local telemetry simulator
- Structured `400`, `404`, `422`, and sanitized `500` error responses

## Tech Stack

| Area | Technology |
| --- | --- |
| Frontend | Next.js App Router, React, TypeScript, Recharts, native CSS |
| Backend | Next.js Route Handlers, TypeScript, Zod, service/repository separation |
| Data | PostgreSQL, Prisma schema and migrations |
| Testing | Vitest, React Testing Library, PostgreSQL-backed integration tests |
| Local development | Docker Compose, deterministic seed, telemetry simulator |

## Quick Start

### Prerequisites

- Node.js 20.19+, 22.12+, or 24+
- npm
- Docker with Docker Compose, or a compatible PostgreSQL instance

### Run locally

```bash
npm install
cp .env.example .env
docker compose up -d
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`. The example environment points to the PostgreSQL service defined in `compose.yaml`; replace it when using another database.

Open [http://localhost:3000](http://localhost:3000). To add live readings, leave the application running and start the simulator in a second terminal:

```bash
npm run simulate
```

The simulator is a development/demo producer that runs separately from Next.js. It targets `http://localhost:3000` by default; `TELEMETRY_API_BASE_URL` can override that base URL.

About every five seconds it sends bounded readings through `POST /api/metrics`, exercising the real validation and PostgreSQL persistence path while intentionally skipping the Stale and No Data devices. It does not use Prisma or connect directly to PostgreSQL, and it stops with Ctrl+C. The live charts, fleet states, and summaries update as those requests are polled.

## Demo

The repeatable seed creates 12 registered devices and the intended operational states:

| State | Seeded example |
| --- | --- |
| Normal | Rack A1/A2/A3, Rack B1, UPS 02, Cooling Unit 01/02, PDU A1 |
| Warning | UPS 01 |
| Critical | Rack B2 |
| Stale | PDU B1 |
| No Data | Rack C1 |

After the simulator starts, ten devices send bounded readings through the public ingestion API about every five seconds. PDU B1 and Rack C1 remain excluded so Stale and No Data stay demonstrable. Fleet and selected-device data refresh approximately every 15 seconds, and charts fill from persisted telemetry. Exact values drift within controlled profile ranges.

Re-running the seed replaces telemetry only for the 12 known demo IDs. It does not truncate tables or delete unrelated devices or metrics.

## API

### Ingest telemetry

`POST /api/metrics`

```json
{
  "deviceId": "rack-a1",
  "power": 612,
  "temperature": 77,
  "timestamp": "2025-10-09T14:00:00Z"
}
```

`timestamp` is a timezone-aware ISO 8601 source-event time and maps to `recordedAt`. Power and temperature must be finite numbers. A successful response is `201 Created` and contains the persisted metric.

### Query telemetry

- `GET /api/devices` returns every device and its latest metric, or `null` when it has never reported.
- `GET /api/devices/:id/metrics?windowSeconds=60` returns chronological metrics in an inclusive recent event-time window. The default is 60 seconds; accepted values are integers from 1 through 3600.
- `GET /api/devices/:id/live` returns device metadata, its latest known metric, and the complete current 60-second history window.

Telemetry GET responses use `Cache-Control: no-store` so browser or intermediary caching does not make polling reuse stale snapshots.

### Error responses

| Status | Meaning |
| --- | --- |
| `400` | Malformed JSON or invalid query parameters |
| `404` | Unknown registered device |
| `422` | Valid JSON that fails the telemetry contract |
| `500` | Sanitized unexpected infrastructure failure |

Internal exceptions, stack traces, and database details are not returned to clients.

## Data Model

### Device

| Field | Purpose |
| --- | --- |
| `id` | Stable registered-device identifier |
| `name` | Operator-facing name |
| `location` | Optional facility location |
| `createdAt` | Registry creation time |

### Metric

| Field | Purpose |
| --- | --- |
| `id` | Auto-incrementing PostgreSQL `BigInt` storage identity |
| `deviceId` | Foreign key to `Device` |
| `power` | Recorded power value |
| `temperature` | Recorded temperature value |
| `recordedAt` | Device/source event time |
| `receivedAt` | Database ingestion receipt time |

A `Device` has many `Metric` rows. The foreign key uses `ON DELETE RESTRICT`, so a device with telemetry cannot be silently deleted together with its history. Device deletion and lifecycle management are intentionally outside this take-home; the restriction is verified against PostgreSQL.

`Metric.id` is storage identity and a deterministic ordering tie-breaker. It is **not** source-event identity. API serializers expose it as a decimal string because JavaScript JSON cannot serialize `bigint` directly.

### Index rationale

The metric table has an index on `(deviceId, recordedAt DESC)`, matching the main per-device access pattern:

```sql
WHERE device_id = ?
  AND recorded_at BETWEEN ? AND ?
ORDER BY recorded_at ...
```

It supports recent-history and latest-reading lookups for an individual device. Queries additionally order by `id` to make equal-`recordedAt` results deterministic. The index does not include `id` because no measured need justified a wider write-amplifying index in this implementation.

This index is not presented as a complete solution for fleet-wide latest-state reads at 50,000 devices. A dedicated latest-state projection becomes more appropriate if profiling shows raw-history lookups are a bottleneck.

## Architecture

### Current Data Flow

```text
Telemetry producer
      |
      v
POST /api/metrics
      |
      v
Zod validation
      |
      v
Ingestion service
      |
      v
Repository / Prisma
      |
      v
PostgreSQL
      |
      +------------------------+
      |                        |
      v                        v
GET /api/devices       GET /api/devices/:id/live
      |                        |
      +------------+-----------+
                   |
                   v
            React dashboard
```

The simulator follows the same public `POST /api/metrics` path as any other producer. Neither the browser nor the simulator writes directly to the database, and the frontend does not issue a per-device N+1 series of fleet requests.

### Why a unified Next.js application

Next.js provides one deployable application, shared TypeScript contracts and utilities, a React frontend, and API routes with low local operational overhead. That is a good fit for demonstrating a complete vertical slice while route handlers, services, and repositories remain separated.

This choice does not require ingestion, querying, and frontend delivery to remain one deployment forever. They can be separated when scale, failure isolation, or team ownership provides a measured reason. Microservices are not automatically superior for the current workload.

### Why PostgreSQL

PostgreSQL provides durable writes, relational integrity, mature indexing, and predictable recent-window queries with modest operational complexity. It is appropriate for the take-home and meaningful telemetry workloads.

It is not assumed to be the permanent answer for arbitrary ingest and indefinite raw retention. Extremely high sustained rates, compression/downsampling needs, or large analytical ranges may justify PostgreSQL partitioning, TimescaleDB or another time-series-optimized store, and object-storage archival—after workload measurement.

### Why Prisma

Prisma keeps the schema and migrations readable, provides type-safe application access, and supports the current repository query shapes clearly. The repository layer also limits how widely persistence choices leak into services.

An ORM does not eliminate database-performance work. Generated SQL must be understood, fleet latest-state queries should be profiled at realistic scale, and hot ingestion may eventually justify targeted SQL, PostgreSQL `COPY`, bulk inserts, or database-specific features.

### Ingestion

The current acknowledgement path is:

```text
POST request -> async database I/O -> await PostgreSQL insert -> 201
```

The Node.js event loop is not synchronously blocked while database I/O is pending. The HTTP request does remain outstanding, however, and ingestion latency and throughput are directly coupled to PostgreSQL latency, connection availability, and write capacity. This direct durable persistence is a deliberate take-home tradeoff.

Ingestion performs a device lookup followed by a metric insert. The lookup provides a clear `404` for unregistered device IDs, at the cost of an extra database round trip and a theoretical race if the device is deleted between operations. The foreign key preserves integrity. There is no deletion API here; with a production lifecycle, options include mapping the FK conflict, soft deletion, or coordinating lifecycle changes transactionally.

### Querying and Live Telemetry

Latest readings use `recordedAt DESC, id DESC`; chronological history uses `recordedAt ASC, id ASC`. Equal event times are therefore stable, while `id` remains only a tie-breaker.

`/live` returns a complete replacement payload for the current 60-second window. Device metadata, latest metric, and history can involve separate reads, so the result is not claimed to be a transactionally isolated database snapshot. Slight cross-field differences during concurrent ingestion are acceptable for this monitoring UI. Strict consistency could use one SQL statement or an appropriate transaction/isolation strategy.

A full snapshot keeps requests stateless, self-heals after missed polls, naturally drops old samples, avoids cursor and duplicate-merge bookkeeping, and allows late readings to appear at their event-time position. The tradeoff is repeated payload data, which is reasonable for a one-minute demo window.

### Frontend Polling

The assignment permits polling, and an approximately 15-second update target does not justify persistent-connection complexity here. Standard HTTP polling is stateless, easy to recover, and straightforward to test. Both hooks schedule the next request after the current request completes, avoiding overlaps; cancellation and generation/device guards prevent stale responses from replacing newer state.

SSE could be appropriate for substantially lower-latency one-way server-to-client updates or to reduce unchanged polling. WebSockets are more appropriate for genuinely bidirectional, low-latency interactions such as device commands or interactive subscriptions. Neither is inherently more scalable without considering connection count, fan-out, state, and infrastructure.

## Alerting and Freshness

The assignment does not define units, thresholds, or freshness. The UI uses centralized demonstration assumptions:

| Signal | Warning | Critical |
| --- | ---: | ---: |
| Temperature | `>= 85 °F` | `>= 95 °F` |
| Power | `>= 1000 W` | `>= 1250 W` |

- Current: latest event-time age is at most 45 seconds.
- Stale: latest event-time age is greater than 45 seconds.
- No Data: no latest metric exists.

Final state precedence is **No Data -> Stale -> Critical -> Warning -> Normal**. Measurement health and reporting freshness are different concerns: a previously normal reading does not establish current health after reporting stops. Status is derived rather than persisted because it depends on the latest reading, elapsed time, and current threshold configuration.

## Time Semantics

### `recordedAt` and `receivedAt`

`recordedAt` is source event time. It drives charts, historical windows, latest selection, rolling averages, and the current take-home freshness model because operators generally care when the physical measurement occurred.

`receivedAt` is ingestion receipt time. It is retained for measuring transport delay, ingestion lag, out-of-order delivery, and reporting-pipeline health.

### Late and out-of-order telemetry

Late telemetry is retained. An older event arriving after a newer one receives a newer `receivedAt`, keeps its older `recordedAt`, appears in the correct historical chart position, and does not replace a newer event-time reading as latest. Database-backed tests cover this behavior.

### Future timestamps

The contract validates timestamp format but does not impose domain-specific clock skew. A valid future-dated event can become latest by `recordedAt` while being excluded from a live history window capped at server `asOf`. This is a known limitation. Production policy might reject, flag, or quarantine events beyond a device-appropriate skew allowance; no universal skew value is assumed here.

### Rolling average

For a chart point at time `T`, each rolling average includes samples satisfying:

```text
T - 10 seconds <= sample.timestamp <= T
```

Power and temperature are averaged separately. A time-based window is used instead of the last N readings because sampling can be irregular. The current straightforward implementation is `O(n²)`, which is acceptable for roughly one minute of demo data. At high sample density, a sliding-window/deque implementation would make this linear.

## Scaling to 50,000+ Devices

### Workload Assumption

At one event per device every 15 seconds:

```text
50,000 / 15 ≈ 3,333 telemetry events/second
3,333 x 86,400 ≈ 288 million raw readings/day
288 million x 30 ≈ 8.6 billion raw readings/30 days
```

These are illustrative sustained-rate calculations, not measured claims that the current local application supports this workload. Payload size, burstiness, indexes, durability settings, hardware, readers, and retention materially affect capacity.

### What Breaks First

Likely early pressure points are:

1. Application connection-pool saturation or database connection waits
2. The device lookup plus insert performed for every reading
3. Per-reading transaction/WAL commit latency
4. Metric table and index growth
5. Fleet latest-state queries over an ever-growing history table
6. Retry storms after partial application or database outages

The exact first bottleneck requires representative load testing. The application pool can saturate before raw PostgreSQL CPU does.

Async JavaScript does not provide infinite database concurrency: every outstanding database operation consumes or waits for a connection. Across replicas, potential connections are roughly `replica count x per-process pool size`. Pool sizing and PostgreSQL limits must be coordinated. A connection pooler manages connections; it does not create write throughput.

### Production Evolution

One possible measured evolution is:

```text
Devices
   |
   v
Ingestion API
   |
   v
Durable queue / partitioned log
   |
   v
Batch consumers
   |
   +-----------------------+
   |                       |
   v                       v
Raw telemetry store   Latest-state projection
   |                       |
   v                       v
Historical queries      Fleet queries
         \                 /
          \               /
           v             v
              Query API
                  |
                  v
              Dashboard
```

This is a proposed evolution, not the implemented architecture.

### Queueing, Batching, and Backpressure

A durable queue becomes useful for burst absorption, decoupling API availability from database health, controlled consumer concurrency, replay, batching, fan-out, and partitioned per-device ordering when required.

It does not by itself solve idempotency, infinite sustained overload, invalid timestamps, poison messages, read scaling, retention, or exactly-once delivery. Acknowledgement semantics also change: today `201` means PostgreSQL persistence succeeded; in a queued design, success may mean only that the event was durably accepted into the queue and is not yet queryable.

Batching improves efficiency by writing multiple readings per transaction or operation. Backpressure prevents unbounded overload when producers remain faster than consumers. Production controls can include bounded queues, controlled concurrency, `429` or `503`, `Retry-After`, and jittered exponential backoff. Batching alone does not solve overload.

### Read Scaling

A latest-state projection could remove fleet reads from the ever-growing raw history path:

```text
latest_device_metric
- device_id (primary key)
- metric_id
- recorded_at
- received_at
- power
- temperature
```

Consumers would update a device row only when the incoming event is newer under the selected `recordedAt`/tie-breaker rule. The queue addresses write delivery and buffering; the projection addresses read performance. They are separate concerns.

The current history API bounds elapsed time but not absolute row count. At demo cadence its payload is small. At high per-device sampling rates, even 60 seconds can be large; possible mitigations include row caps, downsampling, aggregation, cursor/delta transport, or push subscriptions.

### Retention and Historical Storage

Indefinite raw retention in one unpartitioned table is unreasonable at hundreds of millions of readings per day. Production data-lifecycle choices can include:

- Bounded raw retention
- Time-based partitioning and dropping old partitions
- Hourly or daily rollups
- Downsampled historical series
- Compression or a time-series-optimized store
- Object-storage archival for infrequent access

The right combination depends on product query requirements, compliance, recovery objectives, and cost.

## Reliability and Delivery Semantics

The ingestion contract has no stable producer event ID, message ID, sequence number, or idempotency key. Consequently, retries can create duplicate logical events—for example, PostgreSQL may commit successfully while the HTTP response is lost, causing the producer to retry.

The current semantics are best described as **at-least-once submission with potentially duplicated persistence**, not exactly once. `(deviceId, recordedAt)` is intentionally not unique because two legitimate readings can share an event timestamp; time is not identity.

A server-generated UUID would create unique storage/request identity but would not recognize retries: each retry would receive a different UUID. Production idempotency needs stable upstream identity such as `eventId`, `messageId`, a per-device sequence, a boot-session/sequence pair, or an idempotency key, with uniqueness enforced on that identity.

## Tradeoffs and Assumptions

- Devices are preregistered and device IDs are stable.
- Watts and degrees Fahrenheit are demo display assumptions.
- Alert thresholds and the 45-second freshness boundary are demo policy.
- Input timestamps represent source event time.
- Device clocks are trusted beyond strict format validation.
- Duplicate logical events are possible.
- Fleet and live polling cadence is approximately 15 seconds.
- Simulator cadence is approximately five seconds.
- The take-home environment is single-tenant.
- Strict transactional consistency across all `/live` fields is not required.
- Direct PostgreSQL persistence is preferred over premature queue infrastructure for this scope.

## Future Production Concerns

Not implemented in the take-home:

- Device authentication and authorization that binds credentials to `deviceId`
- TLS and, where appropriate, mutual TLS
- Replay protection, request-body limits, and per-device rate limiting
- Tenant isolation and production secret management
- Audit logging, deployment automation, backups, and recovery procedures
- Explicit retention and deletion policies

Useful operational signals would include ingestion rate and latency percentiles, validation and unknown-device errors, database query/commit latency, pool utilization and wait time, WAL/storage growth, event-time ingestion lag, future-skew counts, device last-seen age, fleet/live query latency, and response row count/size. If a queue is added, queue depth and oldest-backlog age become critical. Successful telemetry payloads should not be logged individually at production volume.

## Testing

The suite contains 141 behavioral tests covering:

- Ingestion validation and API error contracts
- Repository/service behavior and real PostgreSQL edge cases
- Duplicate and equal-timestamp events
- Late/out-of-order and future-dated telemetry
- Foreign-key and `ON DELETE RESTRICT` behavior
- Inclusive time-window and rolling-average boundaries
- Runtime client response validation and JSON-safe IDs/dates
- Polling overlap, cancellation, stale-response, retry, and cleanup behavior
- Simulator profiles, alert/freshness classification, search/filtering, and UI states

The number is descriptive rather than proof of quality; the emphasis is externally observable behavior and high-value boundary cases. Run the complete checks with:

```bash
npm test
npm run lint
npm run typecheck
npm run build
git diff --check
```

## AI-Assisted Development

Aravolta explicitly permitted AI-assisted development. AI tools supported implementation, design exploration, code review, test-case generation, and documentation review. The candidate reviewed and validated the architecture, code, tests, and tradeoffs.

Suggestions were deliberately rejected when they added complexity without solving the demonstrated problem, including premature distributed infrastructure, WebSockets when polling satisfies the requirement, `(deviceId, recordedAt)` uniqueness without source-event identity, and unnecessary client state/query dependencies.
