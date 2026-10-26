# Web App Specification

Specification for **JH Finance** web client (`apps/web`, package `@jh-finance/web`) — Vite 7 + React 19 SPA that analyzes a household ledger. Default data is `packages/shared` fixtures; optional live GET against the Nest client.

Product intent: [JH-FINANCE.md](./JH-FINANCE.md). Visual/UX: [DESIGN.md](./DESIGN.md). API processes: [API-CLIENT.md](./API-CLIENT.md), [API-PROCESSOR.md](./API-PROCESSOR.md). Repo layout: [app-structure.md](../app-structure.md).

### Overview

One implicit workspace in the browser. There is **no auth, no local DB, no replication, and no writes**. Pages call `api.*` through TanStack Query. `createClient({ baseUrl })` uses in-process fixtures when `VITE_API_URL` is unset or `""`, and `fetch` when it is a non-empty origin.

- **Auth:** none
- **Backend:** optional Nest client (`apps/api` process `client`, prefix `/v1`, CORS `WEB_ORIGIN`)
- **Local DB:** none (no IndexedDB, no PowerSync, no localStorage tenant)
- **Server workflows:** none from web; parse jobs are processor-side and not wired
- **Deploy target:** static files in `apps/web/dist`, served by nginx in `apps/web/Dockerfile` (SPA `try_files` → `index.html`)
- **Cloud/project id:** none in repo. **TBD** if this is ever hosted beyond local Docker

### Tech Stack

| Layer | Technology | Version |
| --- | --- | --- |
| Runtime | Node (`.nvmrc`) | `v24.4.0` |
| Package manager | pnpm | `10.28.2` |
| Monorepo | pnpm workspaces + Turbo | Turbo `^2.6.1` |
| Language | TypeScript | `^5.9.3` |
| Bundler | Vite | `^7.1.10` |
| UI | React | `^19.2.0` |
| Routing | react-router-dom | `^7.9.4` |
| Styling | Tailwind CSS + `@tailwindcss/vite` | `^4.1.14` |
| Server state | TanStack Query | `^5.90.5` |
| Client state | none (`useState` unused) | — |
| Offline DB | none | — |
| API SDK | `client-api-sdk` workspace (hand-written) | source export |
| Shared types/fixtures | `shared` workspace | source export |
| Tests | Vitest + Testing Library + jsdom | Vitest `^3.2.4` |
| Output mode | **Static SPA** (`vite build` → `dist/`) | no SSR, no API routes |

### Directory Structure

```
apps/web/
├── index.html                 # title JH Finance; Inter; #root
├── vite.config.ts             # React + Tailwind; aliases @, shared, client-api-sdk
├── tsconfig.json              # project references → tsconfig.app / tsconfig.node
├── tsconfig.app.json          # paths @/*, shared, client-api-sdk
├── eslint.config.js
├── Dockerfile                 # node:24-alpine build → nginx:1.27-alpine
├── nginx/nginx.conf           # listen 80; SPA fallback
├── public/                    # .gitkeep only
├── .env.example               # VITE_API_URL=
└── src/
    ├── main.tsx               # QueryClientProvider + RouterProvider
    ├── index.css              # @theme tokens
    ├── vite-env.d.ts          # ImportMetaEnv.VITE_API_URL
    ├── api/client.ts          # createClient({ baseUrl: import.meta.env.VITE_API_URL })
    ├── app/router.tsx         # createBrowserRouter
    ├── layouts/WorkspaceLayout.tsx
    ├── pages/                 # route screens + OverviewPage.test.tsx
    │   ├── overview/
    │   ├── cards/
    │   ├── statements/
    │   ├── investments/
    │   └── bills/
    └── components/ui/         # Card, PageHeader, Metric, DataTable, …
```

There are **no** `hooks/`, `providers/`, `stores/`, `features/`, or `lib/` folders (`app-structure.md` describes a template, not this tree).

### Architecture

```
  Browser
  ┌─────────────────────────────────────────────────────────┐
  │  React 19  +  Router  +  TanStack Query                 │
  │  pages/*  →  api (client-api-sdk)                       │
  └─────────────┬───────────────────────────┬───────────────┘
                │ VITE_API_URL unset/""     │ VITE_API_URL set
                ▼                           ▼
        fixtureClient                 liveClient fetch
        packages/shared               GET {baseUrl}/overview|cards|…
        fixtures.ts                   Nest client :3000 + prefix v1
                                      CORS WEB_ORIGIN
                                            │
                                      Prisma (unread today)
                                      fixtures still returned
```

No Auth box. No local replica. Processor is not called from web.

**Data flow**

1. **Provisioning / sign-up:** none. First paint is the demo household (product wants empty — not implemented; see [JH-FINANCE.md](./JH-FINANCE.md)).
2. **Client init:** `main.tsx` creates a default `QueryClient` and mounts `router`. No membership query. Each page starts its own `useQuery` (e.g. `['overview']` → `api.getOverview`).
3. **Workspace filter:** none. No `selectedTenantId`. One global fixture/API dataset.
4. **Write path:** none. `ClientApi` is GET-only. Buttons do not POST.

**Live URL pitfall:** SDK paths are `/overview`, not `/v1/overview`. Nest `API_PREFIX` defaults to `v1`. For live mode set:

`VITE_API_URL=http://localhost:3000/v1`

Empty `VITE_API_URL=` is **falsy** in `if (options.baseUrl)`, so fixtures still load. Unset and empty both mean fixtures.

OpenAPI generate (`pnpm client-api-sdk:generate`) is a console stub. Do not expect `/v1/docs-json` until [API-CLIENT.md](./API-CLIENT.md) says otherwise. Swagger UI is `/docs` on the client process (not under the global prefix unless that changes).

### Routes

| Path | Purpose | Page |
| --- | --- | --- |
| `/` | Overview | `OverviewPage` |
| `/cards` | Credit cards list | `CardsPage` |
| `/cards/:id` | Card detail; unknown id → `/cards` | `CardDetailPage` |
| `/statements` | Bank statements list | `StatementsPage` |
| `/statements/:id` | Bank detail; unknown id → `/statements` | `BankDetailPage` |
| `/investments` | Investments + crypto list | `InvestmentsPage` |
| `/investments/:id` | Account detail; unknown id → `/investments` | `InvestmentDetailPage` |
| `/bills` | Utilities + insurance cards | `BillsPage` |
| `/bills/:id` | Utility detail only; unknown id → `/bills` | `UtilityDetailPage` |

No query-param editors (`?id=`). No profile, login, import, or 404 splat. Insurance has no `:id` route.

Ids in fixtures: `platinum-4821`, `everyday-0937`, `travel-2254`, `store-7710`, `checking-0182`, `joint-3390`, `savings-6617`, `hys-1158`, `401k`, `brokerage-a`, `brokerage-b`, `cold-wallet`, `exchange`, `electricity`, `internet`, `water`, `gas`.

### Layout & Navigation

- **Desktop shell:** `WorkspaceLayout` — `max-w-[1200px]`, header nav, search chrome, AM avatar. See [DESIGN.md](./DESIGN.md).
- **Mobile-web shell:** none (no breakpoint styles).
- **Auth/loading gates:** none. Pending query → `return null` (blank outlet, header remains).
- Nav groups (Overview, Cards, Statements, Bills, Investments) are web-only; there is no other client to mirror.

### Local DB / Collections

Web does **not** talk to Prisma. Types live in `packages/shared/src/types.ts`. Demo rows in `packages/shared/src/fixtures.ts`. Intended server tables (unread by Nest services today):

| Collection (Prisma) | Web access today | Backend filter |
| --- | --- | --- |
| `Account` | Via fixture/API snapshot DTOs | None (no tenant) |
| `Transaction` | Embedded on snapshots | None |
| `Holding` | Embedded | None |
| `Bill` | Utilities + insurance DTOs | None |
| `Document` / import | ❌ | Not in schema |

No membership or `workspaceId` filter. Shared package is isomorphic (API seed also imports fixtures). There is no mobile copy of these types.

### Authentication

| Item | Value |
| --- | --- |
| Provider | **None** |
| Method | n/a |
| Persistence | n/a |
| State store | n/a (AM chip is static DOM) |
| Emulator | n/a |
| Extra | `app-structure.md` Auth0 is leftover template text |

Do not add Auth0 because the blueprint mentions it. Product: local trusted app ([JH-FINANCE.md](./JH-FINANCE.md) §12.28).

### Build & Deploy

**Output:** Vite client SPA. **Forbids:** SSR, React Router loaders that need a Node server, Next.js API routes, baking secrets that are not `VITE_*`.

`VITE_API_URL` is compile-time. The Dockerfile does **not** declare `ARG`/`ENV` for it, so image builds default to fixtures unless the build environment sets the var.

| Command | Action |
| --- | --- |
| `pnpm dev:web` | Vite dev server (default [http://localhost:5173](http://localhost:5173)) |
| `pnpm --filter @jh-finance/web build` | `tsc -b && vite build` → `apps/web/dist` |
| `pnpm --filter @jh-finance/web preview` | `vite preview` of `dist/` |
| `pnpm --filter @jh-finance/web test` | `vitest run` |
| `pnpm --filter @jh-finance/web lint` | ESLint |
| `docker build -f apps/web/Dockerfile .` | Multi-stage; nginx:80 serves `dist/` |

**Hosting table (in-repo)**

| Command | Action |
| --- | --- |
| Docker image above | Static nginx SPA |
| `docker compose` | **Does not** run web (Postgres + Dragonfly only) |

**Non-targets:** no Vercel/Firebase/App Hosting config, no GitHub Actions in this repo, no CDN project id.

**Notes that can break deploys**

- Docker build context must be **repo root** (workspace `COPY` of `apps/web` + `packages/*`).
- `shared` and `client-api-sdk` have no `build` script; they export TypeScript source. Vite aliases resolve them. Do not publish those packages to npm as-is.
- Node 24 required (Dockerfile `node:24-alpine`; local `.nvmrc`).
- CORS: API `WEB_ORIGIN` must match the web origin if using live client (default `http://localhost:5173`). A Dockerized web on `:80` will fail API calls until `WEB_ORIGIN` is updated — **TBD** for compose-of-web.

### Monorepo Integration

Workspace name: `@jh-finance/web`. Backend lives in `apps/api` (Nest package `api`), not a Firebase package.

| Root script | Delegates to |
| --- | --- |
| `pnpm dev:web` | `pnpm --filter @jh-finance/web dev` |
| `pnpm test:web` | `pnpm --filter @jh-finance/web test` |
| `pnpm build` | Turbo `build` (web emits `dist/**`) |
| `pnpm client-api-sdk:generate` | stub on `client-api-sdk` |
| `pnpm prisma:*` | `api` package (web does not run Prisma) |
| `pnpm dev:api:client:local` | Nest client (optional companion) |

Prettier for web: repo root `prettier.config.js` (`semi: false`, Tailwind plugin). API has its own `.prettierrc`.

### Implementation Status

**Implemented (web)**

- [x] 22 analysis routes under `WorkspaceLayout`
- [x] Fixture-backed `ClientApi` without an API process
- [x] Optional live GET when `VITE_API_URL` is non-empty
- [x] TanStack Query per page
- [x] Vitest: Overview renders `$248,410.52`
- [x] Static `dist/` + nginx Dockerfile
- [x] CORS-friendly default origin documented on API (`WEB_ORIGIN`)

**Not yet on web**

- [ ] Auth
- [ ] Empty workspace first-run
- [ ] Add account
- [ ] PDF/CSV upload, parse status, original-file download
- [ ] Manual create/edit of rows
- [ ] POST/PATCH/DELETE SDK methods
- [ ] Prisma-backed numbers (even live GET is fixtures on the server today)
- [ ] Working search, filters, range chips
- [ ] 404 route
- [ ] Loading and error UI (blank / silent redirect)
- [ ] Mobile client or PWA
- [ ] `VITE_API_URL` Docker build arg
- [ ] OpenAPI-generated SDK
- [ ] Hosting project / CI deploy

### Development

Requires Node `v24.4.0` (`.nvmrc`) and pnpm `10.28.2`.

```bash
nvm use
corepack enable
pnpm install
pnpm dev:web
# → http://localhost:5173  (fixtures; no API needed)
```

Optional live API (still fixture payloads until Nest reads Prisma):

```bash
cp .env.example .env.local          # repo root; DATABASE_URL etc. — do not commit values
docker compose up -d postgres dragonfly
pnpm prisma:generate
pnpm prisma:migrate:local
pnpm prisma:seed:local
pnpm dev:api:client:local           # :3000
```

Web env file **name:** `apps/web/.env` or `.env.local` (Vite). Example: `apps/web/.env.example`.

```bash
# apps/web/.env.local  (gitignored)
VITE_API_URL=http://localhost:3000/v1
```

Restart Vite after changing `VITE_*`. Kill: Ctrl-C on `pnpm dev:web`. No emulator suite.

Tests: `pnpm test:web`.

Sibling backend: `apps/api`. No mobile spec — do not write `docs/MOBILE.md` until there is a client.
