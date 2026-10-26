# API Client Specification

Specification for the **JH Finance** Nest **client** process (`apps/api/apps/client`, workspace package `api`) — Fastify HTTP API that serves the web ledger. Today every domain GET returns `packages/shared` fixtures. Prisma may connect; domain services do not query it.

Product: [JH-FINANCE.md](./JH-FINANCE.md). Web consumer: [WEB.md](./WEB.md). Sibling worker: [API-PROCESSOR.md](./API-PROCESSOR.md). Layout: [app-structure.md](../app-structure.md).

### Overview

Public REST for the Vite app. One implicit workspace (no tenant header, no user). **GET-only, unauthenticated.**

- **Auth:** none (no guards, JWT, or API keys)
- **HTTP:** Fastify via `@nestjs/platform-fastify`; listen `0.0.0.0:${PORT}` (default **3000**)
- **Prefix:** `API_PREFIX` (default `v1`) on all routes except `health`
- **CORS:** `origin: WEB_ORIGIN` (default `http://localhost:5173`)
- **Swagger:** `/docs` (not under `/v1`). Version `0.1.0`, title “JH Finance API”
- **DB:** Postgres via Prisma when `DATABASE_URL` is set; services still return fixtures
- **Jobs:** client **registers** BullMQ `price-sync` but **never enqueues**
- **Deploy target:** `apps/api/Dockerfile` with `API_APP_NAME=client` → `node dist/main.js`
- **Cloud/project id:** none. **TBD**

### Tech Stack

| Layer | Technology | Version |
| --- | --- | --- |
| Runtime | Node (`.nvmrc`) | `v24.4.0` |
| Package | `api` (Nest CLI monorepo) | Nest `^11.1.9` |
| HTTP | Fastify | `^5.6.1` |
| Validation / env | Zod | `^4.1.12` |
| ORM | Prisma + `@prisma/adapter-pg` | `7.7.0` |
| DB | PostgreSQL 16 (`docker-compose`) | — |
| Queue client | `@nestjs/bullmq` + BullMQ | BullMQ `^5.63.0` |
| Cache URL | Dragonfly / Redis (`DRAGONFLY_URL`) | ioredis `^5.8.1` |
| Docs | `@nestjs/swagger` | `^11.2.3` |
| Shared DTOs | `shared` workspace | fixtures + types |
| Tests | Jest | `^30.2.0` |
| Build | `nest build client` (webpack; `shared` bundled — see `webpack.config.js`) | — |

### Directory Structure

```
apps/api/
├── nest-cli.json              # monorepo: client, processor, common, config
├── prisma/schema.prisma
├── prisma/seed.ts             # upserts Account + Bill from shared fixtures
├── prisma.config.ts
├── generated/prisma/          # pnpm prisma:generate — do not edit
├── Dockerfile                 # ARG API_APP_NAME=client|processor
├── .env.example
├── apps/client/src/
│   ├── main.ts                # prefix, CORS, Swagger, listen PORT
│   ├── client.module.ts
│   ├── health/                # GET /health
│   ├── overview/              # GET /v1/overview
│   ├── card/                  # GET /v1/cards…
│   ├── bank/                  # GET /v1/banks…
│   ├── investment/            # GET /v1/investments…
│   └── bill/                  # GET /v1/bills…
├── libs/common/src/           # domain services (fixtures)
│   ├── account/ transaction/ holding/ bill/ overview/
│   ├── prisma/ dragonfly/ bullmq/ logger/
└── libs/config/src/           # envSchema, QUEUE_NAMES, setupSwagger
```

Thin HTTP modules import `@libs/common` services. Do not add domain REST on the processor.

### Architecture

```
  apps/web  --GET-->  Nest client :3000
                         │
                         ├─ /health          (no prefix)
                         ├─ /docs            (Swagger UI)
                         └─ /v1/*            (domain GET)
                                │
                                ▼
                         *Service.list/get → packages/shared fixtures
                         PrismaService may $connect (no query API exposed)
                         BullModule registers price-sync (no queue.add)
                         Dragonfly ioredis lazyConnect (unused by domain)
```

**Data flow**

1. **Provisioning:** none. Seed (`pnpm prisma:seed:local`) upserts fixture accounts/bills for a future read path. Runtime ignores those rows.
2. **Init:** `envSchema.parse(process.env)`. If `DATABASE_URL` missing or connect fails, log “serving fixture data”. Domain methods do not branch on `prisma.isReady()`.
3. **Workspace filter:** none.
4. **Read:** controller → service → `shared` objects (formatted strings).
5. **Write:** no POST/PUT/PATCH/DELETE. Product requires upload + Prisma writes ([JH-FINANCE.md](./JH-FINANCE.md)); not built.

### Routes

All JSON. Prefix `/v1` except health. 404 via `NotFoundException` when `find*` misses.

| Method | Path | Handler | Body |
| --- | --- | --- | --- |
| GET | `/health` | `HealthController.check` | `{ ok: true, process: 'client' }` |
| GET | `/docs` | Swagger UI | HTML |
| GET | `/v1/overview` | `OverviewService.snapshot` | `overview` fixture |
| GET | `/v1/cards/overview` | `OverviewService.cards` | `cardsOverview` |
| GET | `/v1/cards` | `AccountService.listCards` | `cards[]` |
| GET | `/v1/cards/:id` | `AccountService.getCard` | one `CardAccount` |
| GET | `/v1/cards/:id/transactions` | `TransactionService.listCardTransactions` | **all-cards** feed; **ignores `:id`**; not on web SDK |
| GET | `/v1/banks/overview` | `OverviewService.banks` | `banksOverview` |
| GET | `/v1/banks` | `AccountService.listBanks` | `banks[]` |
| GET | `/v1/banks/:id` | `AccountService.getBank` | one bank |
| GET | `/v1/investments/overview` | `HoldingService.overview` | `investmentsOverview` |
| GET | `/v1/investments` | `HoldingService.listAccounts` | `investments[]` |
| GET | `/v1/investments/:id` | `HoldingService.getAccount` | one investment/crypto |
| GET | `/v1/bills/overview` | `BillService.overview` | `billsOverview` |
| GET | `/v1/bills/utilities` | `BillService.listUtilities` | `utilities[]` |
| GET | `/v1/bills/utilities/:id` | `BillService.getUtility` | one utility |
| GET | `/v1/bills/insurance` | `BillService.listInsurance` | insurance cards (no `:id`) |

**Unused service methods (no HTTP):** `TransactionService.listRecent`, `listBankLines`; `AccountService.listInvestments`, `listAll`.

**Web SDK mapping:** see [WEB.md](./WEB.md). Set `VITE_API_URL=http://localhost:3000/v1` so `/overview` hits `/v1/overview`.

### Layout & Navigation

n/a (HTTP). Swagger is the explorer. Point UI chrome to [DESIGN.md](./DESIGN.md).

### Database / Collections

Schema: `apps/api/prisma/schema.prisma`. Generated client: `apps/api/generated/prisma/`.

| Model | Seeded | Served on GET | Notes |
| --- | --- | --- | --- |
| `Account` | ✅ from fixtures | ❌ (fixtures) | kinds `CREDIT_CARD\|BANK\|INVESTMENT\|CRYPTO` |
| `Transaction` | ❌ | ❌ | |
| `Holding` | ❌ | ❌ | |
| `Bill` | ✅ partial (no `paidFromId`/`dueAt`) | ❌ | `UTILITY\|INSURANCE` |
| `Document` / `ImportJob` | ❌ not in schema | — | **Required** by product |

No tenant column. `PrismaService` exposes `$connect` / `$disconnect` / `isReady()` only.

### Authentication

| Item | Value |
| --- | --- |
| Provider | **None** |
| Guards | none |
| Persistence | n/a |
| Emulator | n/a |

Binding this process to a public NIC without auth is unsafe once real documents exist. Product: local trusted app.

### Env (names only)

From `apps/api/libs/config/src/env.ts` / `apps/api/.env.example`:

| Name | Default | Used for |
| --- | --- | --- |
| `NODE_ENV` | `development` | |
| `PORT` | `3000` | HTTP listen |
| `PROCESSOR_PORT` | `3001` | **not used by this process** |
| `DATABASE_URL` | optional | Prisma connect |
| `DRAGONFLY_URL` | `redis://localhost:6379` | BullMQ + ioredis |
| `API_PREFIX` | `v1` | global prefix |
| `WEB_ORIGIN` | `http://localhost:5173` | CORS |

Never commit `.env.local` values.

### Build & Deploy

Webpack Nest build. Output `apps/api/dist/apps/client`. `shared` is **bundled** (webpack externals callback returns `callback()` for `shared`), not left as a node external.

| Command | Action |
| --- | --- |
| `pnpm --filter api build` | `nest build client && nest build processor` |
| `docker build -f apps/api/Dockerfile --build-arg API_APP_NAME=client .` | Image CMD `node dist/main.js` |

**Context:** repo root. Copies `node_modules` into the runner (large). No compose service for the API.

**Non-targets:** no serverless/Lambda, no processor HTTP domain routes, no App Hosting.

**Gotchas**

- Scripts `source .env.local` from **`apps/api` cwd**, not the repo root. Copy `apps/api/.env.example` → `apps/api/.env.local`. Root `.env.example` is the same keys for humans.
- `dev:api:client:local` uses `set -a && source .env.local` — **bash/zsh**. The shebang of the script is npm; it will fail in a pure POSIX `sh` if `source` is missing (npm on macOS often uses the user shell).
- Prisma 7: `prisma.config.ts` holds the URL; `schema.prisma` has no `url`.
- Health is excluded from prefix; do not look for `/v1/health`.
- Swagger at `/docs`, not `/v1/docs`. `client-api-sdk` generate script mentioning `/v1/docs-json` is a stub.

### Monorepo Integration

| Root script | Delegates to |
| --- | --- |
| `pnpm dev:api:client:local` | `api` `dev:api:client:local` |
| `pnpm prisma:generate` | `prisma generate` |
| `pnpm prisma:migrate:local` | `prisma migrate dev` with `.env.local` |
| `pnpm prisma:seed:local` | `tsx prisma/seed.ts` |
| `pnpm test:api` | Jest (`account.service.spec.ts`: 4 cards from fixtures) |
| `pnpm client-api-sdk:generate` | stub; does not read this OpenAPI |

### Implementation Status

**Implemented (client)**

- [x] Fastify listen, CORS, Swagger 0.1.0
- [x] GET health + domain routes listed above
- [x] Fixture payloads matching web `ClientApi`
- [x] 404 on unknown card/bank/investment/utility id
- [x] Prisma connect/disconnect scaffolding
- [x] Docker `API_APP_NAME=client`

**Not yet on client**

- [ ] Read Prisma instead of `shared`
- [ ] Query API on `PrismaService`
- [ ] POST upload / account CRUD / manual rows
- [ ] `Document` model
- [ ] Auth
- [ ] Enqueue parse or `price-sync`
- [ ] Per-card `GET /cards/:id/transactions`
- [ ] Numeric amounts instead of preformatted strings
- [ ] Tenant / user
- [ ] OpenAPI-generated SDK

### Development

```bash
nvm use
corepack enable
pnpm install
cp apps/api/.env.example apps/api/.env.local   # edit locally; do not commit
docker compose up -d postgres dragonfly
pnpm prisma:generate
pnpm prisma:migrate:local
pnpm prisma:seed:local
pnpm dev:api:client:local
# → http://localhost:3000/health
# → http://localhost:3000/docs
# → http://localhost:3000/v1/overview
```

Companion web: [WEB.md](./WEB.md) (`VITE_API_URL=http://localhost:3000/v1`). Worker: [API-PROCESSOR.md](./API-PROCESSOR.md).
