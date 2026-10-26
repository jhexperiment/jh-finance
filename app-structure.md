# App structure (Turbo + pnpm workspace)

This document describes the repository layout so another product can be scaffolded the same way. It is a **structural blueprint**, not a product spec. Copy the folders, tooling, and boundaries; leave domain code behind.

## What this shape is

A **pnpm workspace** orchestrated by **Turbo**. Deployable applications live in `apps/`. Reusable libraries, generated SDKs, and ops CLIs live in `packages/`.

The API uses **Prisma** for the database schema (PostgreSQL), **BullMQ** for queued and scheduled jobs, and **Zod** for validation and env configs. The Nest `client` process serves REST; the Nest `processor` process consumes those jobs.

Two nesting levels matter:

1. **Workspace apps** — `apps/api`, `apps/web`, … each is a pnpm package.
2. **NestJS apps inside `apps/api`** — `apps/api` is itself a NestJS CLI monorepo with multiple processes (`client`, `processor`) that share Nest libraries under `apps/api/libs/`.

Do not flatten those. The Nest processes are not sibling Turbo apps; they share one `package.json`, one Prisma schema, and one Nest CLI config.

## Tooling

| Tool | Role | Where it lives |
|------|------|----------------|
| **Node** | Runtime | `.nvmrc` (currently `v24.4.0`). Run `nvm use` before `pnpm` in a new shell. |
| **pnpm** | Package manager + workspaces | `"packageManager": "pnpm@10.28.2"` in root `package.json`. Lockfile: `pnpm-lock.yaml`. |
| **Turbo** | Task graph (`build`, `dev`, `lint`, `test`) | `turbo.json` at repo root. |
| **TypeScript** | Language | Per-package `tsconfig`. Root `tsconfig.json` only holds shared path aliases. |
| **ESLint 9** | Lint (flat config) | Per app (`apps/api/eslint.config.mjs`, `apps/web/eslint.config.js`). |
| **Prettier** | Format | Split: API uses `apps/api/.prettierrc`; web/dashboard use root `prettier.config.js`. |
| **Prisma** | Database schema and migrations (PostgreSQL) | `apps/api/prisma/` (`schema.prisma`, `migrations/`). Generated client in `apps/api/generated/prisma/` — never edit; run `pnpm prisma:generate`. One schema shared by all Nest processes. |
| **BullMQ** | Queued and scheduled jobs (Redis-backed) | Queue names in `apps/api/libs/config` (`queues.ts`). Producers (usually `client`) enqueue; `processor` workers consume. HTTP on the processor is health-only. |
| **Zod** | Validation and env configs | Env schema in `apps/api/libs/config` (`env.ts`); `ConfigModule` parses with `envSchema.parse`. Also used for request/payload and shared-package validation. |

Root `package.json` is private. It does not contain application code. Its scripts are **thin filters** into workspace packages:

```bash
pnpm --filter api build
pnpm --filter @modulo-canton-app/web dev
pnpm --filter internal-scripts canton:cli:testnet
```

Turbo pipeline (`turbo.json`):

```json
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": { "outputs": [] },
    "test": { "outputs": [] }
  }
}
```

`build` of a package waits on `^build` of its workspace dependencies. Most shared packages export TypeScript source directly (no `dist`), so they often have no `build` script.

## Workspace membership

`pnpm-workspace.yaml`:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - '!packages/canton-indexer'   # optional: exclude a nested repo with its own lockfile
```

Rules:

- Every `apps/<name>` and `packages/<name>` is a package if it has a `package.json`.
- Cross-package deps use `"workspace:*"` (e.g. `"shared": "workspace:*"`).
- Nested `package.json` files that are **not** workspace members (validator docker trees, examples) are ignored by pnpm; do not put those at `packages/<name>/package.json`.
- Exclude a package from the workspace only when it is a true submodule with its own `packageManager` / lockfile.

## Top-level tree

```
.
├── apps/                      # deployable / runnable products
│   ├── api/                   # NestJS CLI monorepo (HTTP + workers)
│   └── web/                   # Vite + React user UI
├── packages/                  # libraries, generated SDKs, CLIs, lambdas
│   ├── shared/                # isomorphic helpers (API + web)
│   ├── internal-scripts/      # ops CLIs (Commander + tsx)
│   └── …                      # other libs / lambdas
├── package.json               # workspace root scripts + pnpm packageManager
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── turbo.json
├── prettier.config.js         # web/dashboard Prettier
├── tsconfig.json              # optional root path aliases
├── .nvmrc
└── .gitignore                 # node_modules, .env*, dist, .turbo, …
```

Scaffold minimum: `apps/api`, `apps/web`, `packages/shared`, plus the four root files (`package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `turbo.json`).

## `apps/` vs `packages/`

| Put it in `apps/` when… | Put it in `packages/` when… |
|-------------------------|-----------------------------|
| It is a process users or ops run (HTTP server, SPA, worker). | It is imported by more than one app, or is a CLI / lambda / generated SDK. |
| It has its own Dockerfile / port. | It has no public HTTP surface. |
| NestJS: the **CLI monorepo root** (`apps/api`), not each Nest process. | NestJS **domain libs that are not Nest-specific** (pure TS used by API + CLI). |

Nest-specific modules (`PrismaModule`, guards, controllers' services) stay under `apps/api/libs/`. Pure functions and types that web also needs go in `packages/shared` (or another `packages/*`).

---

## `apps/api` — NestJS with multiple processes

`apps/api` is a **NestJS CLI monorepo** (`nest-cli.json` `"monorepo": true`). One pnpm package named `api`. Multiple Nest **projects** inside it.

```
apps/api/
├── package.json               # name: "api"
├── nest-cli.json              # lists Nest applications + libraries
├── tsconfig.json              # path aliases for @libs/* and packages/*
├── tsconfig.build.json
├── eslint.config.mjs
├── .prettierrc                # singleQuote, trailingComma: all
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── prisma.config.ts
├── generated/prisma/          # NEVER edit; pnpm prisma:generate
├── apps/                      # Nest applications (processes)
│   ├── client/                # public REST (Fastify/Express + Swagger)
│   └── processor/             # BullMQ workers; HTTP is health-only
├── libs/                      # Nest libraries shared by those processes
│   ├── common/                # domain modules, Prisma, Redis, auth, queues
│   └── config/                # Zod env schema, queue names, Swagger
├── scripts/                   # API-local debug utilities (not ops CLIs)
├── test/                      # Jest setup / mocks
└── Dockerfile                 # build arg API_APP_NAME=client|processor
```

### Nest CLI projects

`nest-cli.json` registers each process and library:

```json
{
  "monorepo": true,
  "root": "apps/client",
  "sourceRoot": "apps/client/src",
  "projects": {
    "client":     { "type": "application", "root": "apps/client",     "entryFile": "main" },
    "processor":  { "type": "application", "root": "apps/processor",  "entryFile": "main" },
    "common":     { "type": "library",     "root": "libs/common",     "entryFile": "index" },
    "config":     { "type": "library",     "root": "libs/config",     "entryFile": "index" }
  }
}
```

Run a process:

```bash
pnpm --filter api start client --watch
pnpm --filter api start processor --watch
# or via root wrappers that source env files:
pnpm dev:api:client:testnet
pnpm dev:api:processor:testnet
```

Each process has:

- `apps/<process>/src/main.ts` — bootstrap (`NestFactory.create`, global prefix, swagger, logger).
- `apps/<process>/src/<process>.module.ts` — root module; imports domain modules.
- `apps/<process>/tsconfig.app.json` — extends `apps/api/tsconfig.json`, `outDir` under `dist/apps/<process>`.

### Thin process shells vs shared domain libs

This split is the Nest pattern to copy:

| Layer | Path | Owns |
|-------|------|------|
| **HTTP / worker shell** | `apps/api/apps/<process>/src/<domain>/` | Controllers (client) or processors/schedulers (processor). Thin modules that import the common module. |
| **Domain logic** | `apps/api/libs/common/src/<domain>/` | `*.module.ts`, `*.service.ts`, DTOs, jobs, specs. Table ownership lives here. |
| **Config** | `apps/api/libs/config/src/` | Zod `envSchema`, queue name constants, Swagger helper. |

Example (asset domain):

```
apps/api/apps/client/src/asset/
  asset.module.ts          # imports CommonAssetModule, registers AssetController
  asset.controller.ts
  asset.controller.spec.ts

apps/api/libs/common/src/asset/
  asset.module.ts          # Prisma + Redis, provides/exports AssetService
  asset.service.ts
  asset.service.spec.ts
  index.ts                 # barrel
```

Client module is a wire-up:

```ts
@Module({
  imports: [CommonAssetModule],
  controllers: [AssetController],
})
export class AssetModule {}
```

Common module owns the service:

```ts
@Module({
  imports: [PrismaModule, RedisModule],
  providers: [AssetService],
  exports: [AssetService],
})
export class AssetModule {}
```

Processor domains follow the same idea: `apps/processor/src/<domain>/*processor.ts` injects services from `@libs/common/<domain>`.

### Nest import aliases

Configured in `apps/api/tsconfig.json` `compilerOptions.paths` and mirrored in Jest `moduleNameMapper`:

| Alias | Maps to |
|-------|---------|
| `@libs/common` / `@libs/common/*` | `libs/common/src` |
| `@libs/config` / `@libs/config/*` | `libs/config/src` |
| `@generated/prisma` | `generated/prisma` |
| `shared`, … | `../../packages/<name>/src` |

Inside a domain folder, relative imports are fine. Across domains, import the other domain's service through its module — do not reach into another domain's Prisma model from an unrelated service.

### Adding a Nest process

1. `pnpm --filter api nest g app <name>` (or copy `apps/processor` and rename).
2. Register it in `nest-cli.json` `projects`.
3. Add `apps/<name>/tsconfig.app.json`.
4. Import shared `ConfigModule` + `LoggerModule` + `RedisModule` (and `BullmqModule` if it consumes queues).
5. Add root scripts: `dev:api:<name>:<env>` that `source .env.<env>` and `pnpm start <name> --watch`.
6. Dockerfile already parameterizes `API_APP_NAME`; pass the new name at build time.

### Adding a Nest domain

1. Create `apps/api/libs/common/src/<domain>/` with `*.module.ts`, `*.service.ts`, `index.ts`, `*.spec.ts`.
2. Register the module in the process root module that needs it (`client.module.ts` and/or `processor.module.ts`).
3. Add a thin controller (client) and/or processor (worker) under `apps/api/apps/<process>/src/<domain>/`.
4. If it has a table, all Prisma access for that table stays in that domain's service.

Naming: kebab-case files (`asset.service.ts`), PascalCase classes (`AssetService`), singular domain folder names (`user`, `asset`).

### Data and jobs

- **Prisma** is the database layer. Schema and migrations live in `apps/api/prisma/` (`schema.prisma`). All Nest processes share that one schema. Table access stays in the owning domain service. Do not edit `generated/prisma/`; regenerate with `pnpm prisma:generate`.
- **BullMQ** is the job layer (async work, retries, scheduled/repeatable jobs). Queue names live in `@libs/config/queues`. The `client` (or any producer) enqueues; `processor` workers consume. Processor HTTP is health checks only — do not add domain REST there.
- **Zod** validates env and other inputs. Env schema lives in `@libs/config` (`env.ts`); Nest `ConfigModule` boots with `envSchema.parse`. Per-network files: `.env.localnet`, `.env.testnet`, `.env.mainnet`, plus staging/prod variants. Scripts: `set -a && source .env.<env> && set +a && …`. Use Zod schemas for payload/config validation rather than ad-hoc checks.
- **Tests**: co-located `*.spec.ts`, Jest, `Test.createTestingModule()`, `jest.Mocked<T>`.

---

## `apps/web` — Vite + React

User-facing SPA. Separate pnpm package (`@modulo-canton-app/web`).

```
apps/web/
├── package.json
├── index.html
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json              # project references
├── tsconfig.app.json          # app + @/* alias
├── tsconfig.node.json         # vite config
├── eslint.config.js
├── Dockerfile                 # multi-stage → nginx
├── nginx/
├── public/
└── src/
    ├── main.tsx               # providers (Auth0, Query, router)
    ├── index.css
    ├── app/                   # App.tsx, router
    ├── api/                   # SDK client wiring
    ├── pages/                 # route-level screens
    ├── features/              # domain hooks + UI fragments
    ├── components/            # shared UI (incl. shadcn-style ui/)
    ├── layouts/
    ├── providers/
    ├── hooks/
    ├── config/
    ├── types/
    ├── ui/                    # assets, design-system pieces
    └── utils/
```

Stack to copy: React 19, Vite 7, TailwindCSS 4 (`@tailwindcss/vite`), TanStack Query 5, React Router, Vitest.

Path alias `@/*` → `./src/*`. Workspace packages are aliased in both Vite and `tsconfig.app.json`:

```ts
// vite.config.ts
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    shared: path.resolve(__dirname, '../../packages/shared/src'),
  },
}
```

Talks to the client API through a **generated SDK** (`client-api-sdk` workspace dep), not hand-written fetch wrappers.

Scripts:

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "test": "vitest run",
  "lint": "eslint ."
}
```

`apps/dashboard` is the same Vite+React shape with `admin-api-sdk` instead of `client-api-sdk`. Scaffold a second SPA by copying `apps/web` and swapping the SDK + env.

---

## Other `apps/` (optional for a new product)

| App | Package name | Purpose |
|-----|----------------|---------|
| `dashboard` | `@modulo-canton-app/dashboard` | Admin SPA (Vite + React). |
| `dragonfly` | `dragonfly` | Redis-compatible cache deploy config / env schema. |

Keep infra-shaped apps in `apps/` when they are deployed or `pnpm`-scripted independently. Keep one-off scripts in `packages/internal-scripts`.

---

## `packages/` — shared libraries, SDKs, CLIs

Each package is a folder with `package.json`. Prefer **source exports** so consumers import TypeScript without a package-level build:

```json
{
  "name": "shared",
  "private": true,
  "packageManager": "pnpm@10.28.2",
  "exports": {
    ".": "./src/index.ts",
    "./points-calculations": "./src/points-calculations/index.ts"
  }
}
```

Dependents:

```json
{
  "dependencies": {
    "shared": "workspace:*"
  }
}
```

If a Nest tsconfig cannot resolve the package name alone, add a `paths` entry pointing at `../../packages/<name>/src`.

### Package kinds

| Kind | Examples here | Scaffold as |
|------|---------------|-------------|
| **Isomorphic lib** | `shared` | Pure TS used by API and web. Subpath exports per area. |
| **Backend lib** | `canton`, `cache`, `assets`, `indexer` | Domain SDK imported by API and CLIs. `exports["."] = "./src/index.ts"`. |
| **Generated OpenAPI SDK** | `client-api-sdk`, `admin-api-sdk` | `@hey-api/openapi-ts`; web depends on it. Script: `generate`. |
| **Auth / secrets helper** | `auth0` | Small focused libs. |
| **Ops CLI bundle** | `internal-scripts` | Many Commander CLIs in one package (see below). |
| **External nested repo** | `canton-indexer` | Own lockfile; excluded from workspace. |

Do not put application controllers or Prisma schema in `packages/`. Do not put reusable calculation/types in `apps/`.

### Adding a library package

1. `packages/<name>/package.json` with `"name"`, `"exports"`, `"private": true`.
2. `packages/<name>/src/index.ts`.
3. Add `"<name>": "workspace:*"` to consumers.
4. If Nest needs it, add `paths` in `apps/api/tsconfig.json` and Jest `moduleNameMapper`.
5. If web needs it, add a Vite `resolve.alias` and `tsconfig.app.json` `paths` entry.

Package names in this repo are often unscoped (`shared`, `modulo-canton`) or scoped (`@modulo-canton-app/web`). Pick one scheme for a new product and stick to it.

---

## CLIs (`packages/internal-scripts`)

Ops and data tools are **not** Nest controllers and **not** `apps/api/scripts/` (that folder is API-local debug only). They live in one workspace package:

```
packages/internal-scripts/
├── package.json               # name: "internal-scripts"
├── tsconfig.json
├── <area>/
│   ├── cli/
│   │   ├── <area>.ts                      # entry: new Command(), registers subcommands
│   │   └── <area>-<subcommand>.ts         # implementation: default `program`
│   ├── lib/                   # helpers for that area
│   └── config/                # env loaders if needed
├── canton/
├── modulo/
├── db/
└── …
```

Pattern (git-style Commander):

1. Entry `<area>/cli/<area>.ts` — `#!/usr/bin/env tsx`, `new Command()`, `.command('sub', 'help')` **two-arg form** so Commander spawns `<area>-sub` next to the entry file.
2. Implementation `<area>/cli/<area>-<kebab-subcommand>.ts` — `import { program } from 'commander'`, typed options, `try/catch`, `process.exit(0|1)`.
3. Root and package scripts source an env file then run tsx:

```json
{
  "canton:cli:testnet": "set -a && source .env.testnet && set +a && tsx canton/cli/canton.ts"
}
```

Root `package.json` re-exports the same names via `pnpm --filter internal-scripts …`.

Invoke: `pnpm canton:cli:testnet get-balance -- --party <id>` (the `--` separates pnpm args from the subcommand).

Full CLI rules: `packages/internal-scripts/.cursor/rules/cli.mdc`.

---

## How the pieces talk

```
  apps/web  ──REST + JWT──►  apps/api/apps/client  ──BullMQ──►  apps/api/apps/processor
       │                           │                                    │
       │                           ├── Prisma / PostgreSQL              ├── same DB
       │                           ├── Redis / Dragonfly                ├── same Redis
       └── client-api-sdk          └── packages/* (canton, shared, …)   └── packages/*
           (packages/)
```

- Web never imports Nest code. It imports `client-api-sdk` and `shared`.
- Client and processor share `libs/common` + `libs/config` + Prisma.
- CLIs import `packages/*` (and sometimes Prisma) but not Nest modules.

Regenerate the web SDK after API contract changes:

```bash
pnpm client-api-sdk:generate
```

---

## Root scripts to copy

Keep root `package.json` scripts as aliases. Typical set for a new product:

```json
{
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "dev:api:client:local": "pnpm --filter api dev:api:client:local",
    "dev:api:processor:local": "pnpm --filter api dev:api:processor:local",
    "dev:web": "pnpm --filter web dev",
    "test:api": "pnpm --filter api test",
    "test:web": "pnpm --filter @scope/web test",
    "prisma:generate": "pnpm --filter api prisma:generate",
    "prisma:migrate:local": "pnpm --filter api prisma:migrate:local"
  },
  "packageManager": "pnpm@10.28.2",
  "private": true
}
```

Filter by the **package.json `name`**, not the folder name, when they differ (`api` vs `@modulo-canton-app/web`).

---

## Conventions to keep when scaffolding

1. **Kebab-case files**, PascalCase classes, camelCase methods, `UPPER_SNAKE` constants.
2. Nest: `module → controller → service`. One controller and one service per domain in a process; processors are extra for queues.
3. **Table ownership**: Prisma access for a table only in that table's domain service.
4. **`decimal.js`** for money/numeric math — never `parseFloat` / `Prisma.Decimal`.
5. **Do not edit** `apps/api/generated/prisma/`; run `pnpm prisma:generate`.
6. **Do not add domain REST** to the processor process.
7. Env files are gitignored (`.env*`) except `!.env.example`.
8. Split Prettier if API (semicolons/decorators) and web (no semicolons, Tailwind plugin) disagree — that is intentional here.
9. Verify with package build (`pnpm --filter api build`, `pnpm --filter @scope/web build`), not tests alone.

---

## Scaffold checklist

Use this as a create-order for a new repo of the same shape.

### 0. Root

- [ ] Node version in `.nvmrc`
- [ ] `package.json` with `"private": true`, `"packageManager": "pnpm@…"`
- [ ] `pnpm-workspace.yaml` with `apps/*` and `packages/*`
- [ ] `turbo.json` with `build` (`dependsOn: ["^build"]`), `dev` (persistent, uncached)
- [ ] Root Prettier (web) and `.gitignore` (`node_modules`, `.env*`, `dist`, `.turbo`)

### 1. Shared package

- [ ] `packages/shared/package.json` with source `exports`
- [ ] `packages/shared/src/index.ts`

### 2. Nest API monorepo

- [ ] `apps/api` via Nest CLI monorepo mode (or copy empty `nest-cli.json` + tsconfig)
- [ ] Libraries: `libs/config` (Zod env), `libs/common` (Prisma, logger, redis)
- [ ] Applications: `apps/client` (REST), `apps/processor` (workers) — omit processor if you have no queues
- [ ] Prisma schema + `prisma.config.ts` + generate script
- [ ] Path aliases `@libs/common`, `@libs/config`
- [ ] Dockerfile with `API_APP_NAME` build arg if you ship more than one process

### 3. Vite web

- [ ] `apps/web` Vite React + Tailwind + TanStack Query
- [ ] `@/` alias and `shared` workspace dep
- [ ] Optional: OpenAPI SDK package consumed by web

### 4. CLIs (when ops need them)

- [ ] `packages/internal-scripts` with Commander + tsx
- [ ] Per-area `cli/<area>.ts` + `<area>-<subcommand>.ts`
- [ ] Root scripts `pnpm --filter internal-scripts <area>:cli:<env>`

### 5. Wire-up

- [ ] `"workspace:*"` deps from api/web → packages
- [ ] Root `dev` / `build` / `test:*` scripts
- [ ] `.env.example` per app
- [ ] `docker-compose.yml` for Postgres + Redis (and the apps if you containerize locally)

That is the whole skeleton. Domain modules, pages, and extra `packages/*` libraries are added on top without changing this layout.
