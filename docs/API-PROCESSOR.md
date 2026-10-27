# API Processor Specification

Specification for the **JH Finance** Nest **processor** process (`apps/api/apps/processor`, same workspace package `api`) — BullMQ workers. HTTP is **health-only**. Today the only worker is a `price-sync` placeholder that does not update holdings and is never enqueued.

Product: [JH-FINANCE.md](./JH-FINANCE.md). HTTP sibling: [API-CLIENT.md](./API-CLIENT.md). Web: [WEB.md](./WEB.md). Layout: [app-structure.md](../app-structure.md).

### Overview

Background process that should run **document parse** (confirmed product loop) and may later refresh prices. As implemented it only:

- Listens on `PROCESSOR_PORT` (default **3001**)
- Serves `GET /health` → `{ ok: true, process: 'processor' }`
- Registers a BullMQ worker on queue `price-sync` that logs `Price sync placeholder for N investment accounts` and returns `{ accounts: N }`

No global prefix, no CORS, no Swagger, no domain REST. Do not add ledger GET/POST here.

- **Auth:** none
- **Broker:** Dragonfly/Redis `DRAGONFLY_URL` (default `redis://localhost:6379`)
- **DB:** same Prisma scaffolding as client (connect-only)
- **Deploy target:** `apps/api/Dockerfile` with `API_APP_NAME=processor`
- **Cloud/project id:** none. **TBD**

### Tech Stack

| Layer | Technology | Version |
| --- | --- | --- |
| Runtime | Node | `v24.4.0` |
| Framework | Nest 11 + Fastify (health HTTP only) | Fastify `^5.6.1` |
| Jobs | `@nestjs/bullmq` + BullMQ | `^5.63.0` / `^11.0.4` |
| Broker | Dragonfly (`docker-compose`) | image `v1.28.1` |
| Domain | `HoldingService` from `@libs/common` | fixture `investments` |
| Env | Zod `envSchema` (shared with client) | |
| Build | `nest build processor` | webpack |

Same `apps/api/package.json` as the client. Versions match [API-CLIENT.md](./API-CLIENT.md).

### Directory Structure

```
apps/api/apps/processor/src/
├── main.ts                      # listen PROCESSOR_PORT; no prefix/CORS/docs
├── processor.module.ts
├── health/
│   ├── health.module.ts
│   └── health.controller.ts     # GET /health
└── price-sync/
    ├── price-sync.module.ts     # imports HoldingModule, provides PriceSyncProcessor
    └── price-sync.processor.ts  # @Processor('price-sync')
```

Shared libs (same as client): `libs/common` (Holding, Prisma, Dragonfly, BullMQ, Logger), `libs/config` (`QUEUE_NAMES.PRICE_SYNC = 'price-sync'`).

**There is no parse module.** Product requires a parse worker; add it under `apps/processor/src/` the same way as `price-sync`, with logic in `libs/common`.

### Architecture

```
  Nest client                 Dragonfly :6379              Nest processor :3001
  BullModule.registerQueue         │                      GET /health
  (price-sync)                     │                      @Processor(price-sync)
        │                          │                              │
        └── queue.add  ❌ none     │◄──── worker waits ───────────┘
                                   │
                          process(): HoldingService.listAccounts()
                                     → log count; no Prisma write
```

```
Intended (not built):
  Client POST upload → store Document → queue.add('parse')
  Processor parse worker → templates → Account/Transaction/Holding/Bill
  Optional later: queue.add('price-sync') → update Holding.value
```

**Data flow**

1. **Provisioning:** none. Repeatable/cron jobs are **not** registered.
2. **Init:** same `ConfigModule` + `PrismaModule` + `BullmqModule`. Worker host starts if Redis is reachable; Redis errors log via ioredis `error` handler.
3. **Job intake:** **nobody produces**. Client imports `BullmqModule` but has no `InjectQueue`.
4. **Job body:** `_job` ignored. Reads fixture investment account list (length 5 in the demo).
5. **Write path:** none.

### Routes

| Method | Path | Body |
| --- | --- | --- |
| GET | `/health` | `{ ok: true, process: 'processor' }` |

No `/v1`, no `/docs`. Anything else is out of scope for this process.

### Queues

| Name (`QUEUE_NAMES`) | Producer | Consumer | Behavior today |
| --- | --- | --- | --- |
| `price-sync` | **None** | `PriceSyncProcessor` | Log placeholder; return `{ accounts }` |
| parse / ingest | **None** | **None** | Required by product; not in code |

`BullmqModule` (`libs/common/src/bullmq/bullmq.module.ts`): `BullModule.forRootAsync` uses `connection: { url: env.DRAGONFLY_URL, maxRetriesPerRequest: null }` and `registerQueue({ name: PRICE_SYNC })`. Both processes import it.

`DRAGONFLY` ioredis token is exported but **not injected** by `PriceSyncProcessor`.

### Database / Collections

Processor does not read or write tables. `HoldingService.listAccounts()` returns shared `investments`. Prisma `Account` / `Holding` are unused here.

When parse exists, this process should be the writer for parse results (table ownership stays in `libs/common` services). See product collections in [JH-FINANCE.md](./JH-FINANCE.md) §9.

### Authentication

None. Health is public. Do not expose processor HTTP beyond localhost; it is not a user API.

### Env (names only)

Same schema as the client. This process uses:

| Name | Default | Role here |
| --- | --- | --- |
| `PROCESSOR_PORT` | `3001` | HTTP listen |
| `DRAGONFLY_URL` | `redis://localhost:6379` | BullMQ |
| `DATABASE_URL` | optional | Prisma connect (unused by the worker) |
| `PORT` | `3000` | unused (client) |
| `API_PREFIX` / `WEB_ORIGIN` | | unused |

Env file: `apps/api/.env.local` (see gotcha in [API-CLIENT.md](./API-CLIENT.md)).

### Build & Deploy

| Command | Action |
| --- | --- |
| `pnpm --filter api build` | builds client **and** processor |
| `docker build -f apps/api/Dockerfile --build-arg API_APP_NAME=processor .` | worker image |

Output: `apps/api/dist/apps/processor`. Same webpack `shared` bundling as client.

**Run two containers/processes** (client + processor) against one Postgres and one Dragonfly. Compose file currently starts **only** Postgres + Dragonfly — not this app.

**Non-targets:** domain REST, Swagger, SSR, cron outside BullMQ.

**Gotchas**

- Processor will sit idle forever without a producer.
- If Dragonfly is down, BullMQ connection errors log; health HTTP may still come up.
- Do not put `/v1/overview` on this port.
- `price-sync` is **not** the ingest pipeline. Do not extend it to parse PDFs; add a parse queue.

### Monorepo Integration

| Root script | Delegates to |
| --- | --- |
| `pnpm dev:api:processor:local` | `nest start processor --watch` with `apps/api/.env.local` |
| `pnpm dev:api:client:local` | companion HTTP (needed to enqueue, once producers exist) |

No processor-only test file. Jest is package-wide (`*.spec.ts`).

### Implementation Status

**Implemented (processor)**

- [x] Fastify health on `PROCESSOR_PORT`
- [x] BullMQ worker host for `price-sync`
- [x] Placeholder `process()` logging fixture account count
- [x] Docker `API_APP_NAME=processor`

**Not yet on processor**

- [ ] Any `queue.add` / scheduler / repeatable job
- [ ] Parse worker (PDF/CSV templates, confidence, overlap ask)
- [ ] Writes to `Document`, `Account`, `Transaction`, `Holding`, `Bill`
- [ ] Real market-data price sync
- [ ] Dead-letter / retry policy beyond BullMQ defaults (unconfigured)
- [ ] Metrics/auth on health

### Development

Requires Dragonfly (or Redis) if you want the worker to connect; Postgres only if you are testing Prisma connect.

```bash
nvm use
corepack enable
pnpm install
cp apps/api/.env.example apps/api/.env.local
docker compose up -d postgres dragonfly
pnpm prisma:generate
pnpm dev:api:processor:local
# → http://localhost:3001/health
```

Nothing will process until something calls `queue.add('price-sync', …)` (not in the repo). HTTP sibling: `pnpm dev:api:client:local`. Product next job: **parse**, not prices ([JH-FINANCE.md](./JH-FINANCE.md) §11.2).
