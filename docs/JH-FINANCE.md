# JH Finance — Product Specification

> **Tagline:** _Import financial documents, parse them, and analyze the household in one workspace._

This document defines product intent, purpose, and direction from a review of `apps/web`, `apps/api` (Nest client + processor), `packages/shared` (types and design fixtures), Prisma (`Account`, `Transaction`, `Holding`, `Bill`), the README’s 22-page map, and **owner direction (26 Oct 2026)**. It is the canonical product spec. Platform and layout details belong in sibling docs ([WEB.md](./WEB.md), [DESIGN.md](./DESIGN.md)); the repo blueprint is [app-structure.md](../app-structure.md).

**Product loop (confirmed):** add accounts → import PDF/CSV (or type rows by hand) → parse with per-institution templates → save to the database → analyze in the UI. The 22-page web app is the analysis surface. It is **not** a live bank aggregator, not a bill-pay rail, and not a broker.

As of 26 Oct 2026 the loop is **not built**. What ships is a high-fidelity, fixture-backed analysis UI for a demo household. Users cannot upload, parse, or persist a real document. Domain services return `packages/shared` fixtures even when Postgres is running. The Statements header already labels the intended capture action (**Upload statement**) and the intended parse result (**Parsed statement lines**); those controls are inert.

### 1. Executive Summary

JH Finance is a household finance workspace whose job is to **turn imported documents into a queryable picture** of what you own and owe: credit cards, bank accounts, retirement and brokerage, crypto, utilities, and insurance, rolled up to net worth. The user imports statements and other financial docs; the system parses them into `Account` / `Transaction` / `Holding` / `Bill` (and future document records); the web UI is how you analyze the result.

The shipped surface is a read-only 22-page analysis UI driven by a demo household in `packages/shared` fixtures. Nest GET routes, Prisma, and a `price-sync` worker are scaffolding around that UI. **Ingest (upload + parse + write) does not exist yet.** That is the gap the product is for.

It is a **local tool for JH** (one household owner). Not a multi-user product. A partner may appear on a joint account as data, not as a login. No advisor, admin, bank-staff, or sign-in. The API stays unauthenticated on a trusted machine.

The **core organizing concept** is the **workspace**: one household’s books, filled by documents, not by a live institution link. There is no `User`, `Workspace`, `Membership`, or `Document` table. `WorkspaceLayout` and the overview Swagger text (“Workspace net-worth snapshot”) name the idea; scoping is currently global (one implicit workspace per deployment). Fixture copy that says “4 linked” accounts is leftover design language — **linking is not the ingest path.**

| Client | Role | Maturity |
| --- | --- | --- |
| `apps/web` | Only user client. **Capture** (upload, intended) and **analysis** (the 22 pages). | ✅ Analysis pages shipped (fixture data). ❌ Upload/parse. 🔶 Search, filters, range, and most action buttons are chrome only. |
| `apps/api` client | REST under `/v1`. Same shapes as the web SDK. | 🔶 GET routes and Swagger shipped; payloads are fixtures, not Prisma. ❌ No upload or write APIs. No auth. |
| `apps/api` processor | Background jobs. HTTP is health-only. | 🔶 `price-sync` queue registered; **nothing enqueues**. ❌ No parse/ingest job. |
| Mobile | — | ❌ Not in the repo. |
| Admin / dashboard | — | ❌ Not in the repo (`app-structure.md` mentions a dashboard pattern from another product; it is not this product). |

Web and API share TypeScript types and the demo dataset via `packages/shared`. Web talks to the API through `packages/client-api-sdk` (hand-written; OpenAPI generation is a stub). When `VITE_API_URL` is empty, the SDK serves fixtures in-process — that is the default `pnpm dev:web` path.

**Business model:** none. Personal local tool; no plans, prices, Stripe, entitlements, or feature flags.

### 2. Problem Statement

Overlapping pains:

- The household’s facts already exist as **files** (card statements, bank PDFs, 401(k) statements, brokerage confirms, utility bills, insurance declarations). They do not exist as one database.
- Re-typing those files into a spreadsheet is slow, error-prone, and dies every month.
- Issuer and broker apps keep each document’s data in a silo, so net worth, due bills, and “where did that $489 go” cannot be asked in one place.
- Recurring charges, unusual spend, statement due dates, and 401(k) drift need a weekly glance over **parsed history**, not a folder of PDFs.

Today’s workarounds fail because the documents stay documents. A Downloads folder is not a ledger. A spreadsheet is not a parse. A live aggregator (Plaid-class) is a different product and is **not** this one.

What this product unifies:

1. **Ingest** — PDF and CSV financial documents, uploaded on each domain section (Cards, Statements, Bills, Investments).
2. **Parse** — lines, balances, holdings, bills, and usage become structured rows.
3. **Persist** — Postgres (`Account`, `Transaction`, `Holding`, `Bill`, and a future document record) is the system of record.
4. **Analyze** — five UI sections roll the same rows up to net worth, spend, cash, invested assets, and bills (`$248,410.52` in the demo household).
5. **Cross-domain questions** once the rows exist: rent and electricity from Checking 0182; internet on Everyday 0937; water on Store 7710; brokerage funded from checking.

### 3. Vision & Product Intent

#### 3.1 What we are building

A household finance **workspace** whose core job is: **import financial documents, parse them, save the data, analyze it.** The 22 pages are the analysis product. Capture is document upload, not institution OAuth.

It is **not** a bank, broker, bill-pay rail, or live account aggregator. Fixture copy is explicit that 401(k) drift is informational (“no trades are placed automatically”). Pay / move / trade buttons stay non-executing unless a later decision reverses that. The product **is** an executor of **parse-and-store**, not of money movement.

#### 3.2 What success looks like

Scenes mix **analysis the demo already shows** with **ingest that is required and not built**. Theater is marked.

1. **Import.** AM uploads this month’s Checking 0182 statement (and, in the same loop, a card PDF, a 401(k) statement, a utility bill). ❌ Not built. Statements page already shows **Upload statement**.
2. **Parse and save.** The processor extracts lines, balances, and metadata; rows land in Postgres; the original file is retained or discarded per a later decision. ❌ Not built. UI already shows **Parsed statement lines**.
3. **Weekly scan.** AM opens Overview, sees net worth, allocation, and attention computed from stored rows (demo: Platinum due Nov 12, flagged $489, electricity due Oct 31, 401(k) match). ✅ Layout shipped · ❌ Live computation.
4. **Drill a flagged charge.** From Cards, open Platinum 4821, see the flagged electronics row against parsed history. ✅ Demo · acting on the flag ❌.
5. **Bills this week.** Electricity from Checking 0182, internet on Everyday 0937, water autopay on Store 7710 — from parsed bills, not fixture copy. ✅ Demo layout · ❌ Live.
6. **Investments without auto-trade.** 401(k) mix from a parsed statement; drift is informational. ✅ Copy shipped; rebalance/trade ❌.
7. **Household, not just “my” checking.** Joint 3390 is “You and partner.” Partner is not a user. 🔶 Data story only.
8. **Run analysis without the API.** `pnpm dev:web` with unset `VITE_API_URL` still renders the demo household. ✅ Fixture path. Not a substitute for parsed data.
9. **Invite / paywall.** ❌ No membership, no billing.

#### 3.3 Guiding principles

| Principle | Implementation |
| --- | --- |
| Documents in, rows out | Import is the only confirmed ingest path. Parse writes Postgres. UI reads Postgres. |
| Analysis is the product | The 22 pages exist to question the stored data, not to decorate fixtures forever. |
| One household picture | Overview rollup + five sections over the same account set. |
| Connect money across domains | `Bill.paidFrom` in schema; fixture `paidFrom` / autopay strings; transfers in bank activity. |
| Attention over decoration | Overview “Needs attention”; card flagged row; bill due statuses — must be derived from parsed rows. |
| Advise, don’t move money | 401(k) drift callout; Pay / Move / Trade stay non-executing unless reversed. |
| Exact money | `decimal.js` in `packages/shared`; Prisma `Decimal(18,2)` / holdings `Decimal(28,8)`. |
| Insurance is summary, not a ledger | Policies are cards on Bills; no `/bills/:id` for insurance (README + Swagger). |
| Crypto sits with investments | `AccountKind.CRYPTO` under `/investments`, not a sixth nav item. |
| Fixtures are a demo, not the product | Demo household shows what analysis looks like; it must not block ingest work. |

### 4. Target Users

#### 4.1 Primary personas

| Persona | Jobs to be done | Client |
| --- | --- | --- |
| **JH — household owner** (demo avatar still says AM until empty states ship). | Add accounts; drop PDF/CSV onto them or type rows; then see net worth, dues, spend, holdings, and bills. | Web only |

The demo is one adult’s books plus a joint checking account. That is the primary job, not “power trader” or “family CFO for five kids.”

#### 4.2 Secondary personas

| Persona | Jobs to be done | Client |
| --- | --- | --- |
| **Partner on Joint 3390** | Appears as co-owner (“either can withdraw”) and as a mid-month transfer source. | ❌ No login, no role, no invite flow |

No other personas appear in screens or schema (no advisor, child, CPA, or employer admin).

#### 4.3 Out of scope (for now)

- Live institution linking (Plaid-class OAuth) as the ingest path
- Other households / sign-up / tenancy
- Multi-workspace / multi-tenant orgs
- Partner login
- Mobile app
- Sign-in / Auth0
- In-app ACH, card pay, or brokerage trading
- Tax filing, 1099 generation, full lot accounting UI (tax-lot download is a button label only)
- Insurance claims or policy shopping
- Credit score, lending, or “open a new card”
- Kids / custodial accounts
- Social investing or public portfolios

### 5. Core Concepts

#### 5.1 Workspace

**Real world:** the household’s books as one place.

**Membership / roles:** none. One implicit workspace per running app. Avatar “AM” is static chrome (`aria-label="Account menu"`), not a session.

**Switching context:** none. No workspace switcher. Card/account filters are section-local and mostly visual.

**Onboarding (intended):** empty workspace → upload on a domain section → parse → Overview shows real rows. **Onboarding (today):** seeded demo household / in-memory fixtures. Product first-run must **not** be the demo AM household.

**Current vs intended:** named in layout and API copy; **not a table**. Whether a future `Workspace` / `Household` with members is required is an open question. Do not add tenancy in feature work until that is decided.

#### 5.1a Document (ingest unit)

**Real world:** a financial file the household already has — bank or card statement, 401(k) or brokerage statement, utility bill, insurance declaration, crypto CSV/PDF, or similar. Exact formats are **not** decided (§13).

**Membership:** belongs to the implicit workspace. No model yet.

**How it enters:**

1. **Add an account** (name/type) on the section — empty workspace has no accounts until you create one.
2. **Upload PDF/CSV onto that account**, or **type rows by hand** (accounts, transactions, bills, holdings — anytime, not only on parse failure).
3. Not a global inbox. Not Overview. v1 formats: **PDF and CSV**. Keep originals **forever**.

**Onboarding:** empty workspace → add account → upload or type.

**Parse policy:** per-institution **templates** (when sample files exist; until then, synthetic fixtures). Auto-save high confidence; review low confidence. Re-import of an overlapping period: **ask**. Manual entry is always available.

**Current vs intended:** **no `Document` / `ImportJob` table, no storage, no parse worker, no POST, no empty states.** Statements already labels **Upload statement**. Cards / Bills / Investments need the same capture control. Processor (BullMQ) is the natural place for parse jobs; today the only queue is unused `price-sync`.

#### 5.2 Account

**Real world:** a card, bank account, retirement/brokerage account, or crypto venue.

**Kinds (Prisma):** `CREDIT_CARD`, `BANK`, `INVESTMENT`, `CRYPTO`. Shared TS uses kebab-case (`credit-card`, …) and **groups** `cards` | `banks` | `investments` | `crypto`.

**Identity in the demo:** slug ids (`platinum-4821`, `checking-0182`, `401k`, `cold-wallet`, …), last-four `mask` on cards/banks.

**Current vs intended:** UI types carry presentation fields (series, APR, rewards, action labels, formatted balances). Prisma `Account` is a thin row: `id`, `name`, `kind`, `subtype`, `mask`, `balance`, `currency` (default `USD`). Seed copies fixtures into `Account`. **Intended:** accounts are created/updated by parse (matched by mask/name — matching rules open).

#### 5.3 Transaction

**Real world:** a posted/pending/scheduled line on a card or bank (and investment/crypto activity in the UI).

**Prisma:** `accountId`, `postedAt`, `description`, `amount`, optional `category` and `status` (free strings). Indexed `(accountId, postedAt)`.

**Current vs intended:** UI activity is fixture arrays. Seed **does not write** `Transaction` rows. **Intended:** transactions are parsed from imported statements and stored here; the UI reads them. `TransactionService` still returns fixture slices. `listRecent` and `listBankLines` have no HTTP; `listCardTransactions` is mounted at `GET /cards/:id/transactions` but ignores `:id` and is **not** on the web SDK.

#### 5.4 Holding

**Real world:** a fund, ETF, RSU lot group, or crypto asset inside an investment/crypto account.

**Prisma:** `name`, `symbol`, `quantity`, `value`, `costBasis`.

**Current vs intended:** UI holdings include day %, total gain, type, share of account — not in Prisma. Seed **does not write** `Holding` rows. **Intended:** holdings come from parsed investment/crypto documents; `price-sync` may later refresh marks, but ingest is the source of positions. Today the worker only logs `listAccounts().length`; **no producer, parse job, or market-data client exists**.

#### 5.5 Bill

**Real world:** a utility account or an insurance policy premium.

**Kinds:** `UTILITY` | `INSURANCE`. Optional `paidFrom` → `Account`, optional `dueAt`, `status` string.

**Current vs intended:** Seed writes utilities and insurance with `amount` + `status`; it does **not** set `paidFromId` or `dueAt`. **Intended:** bills (and usage on utilities) come from imported invoices/statements. UI utilities are first-class pages (`/bills/:id`); insurance is summary cards only. Health deductible progress (`$1,200 of $3,000`) is on the fixture policy; out-of-pocket max (`$1,400 of $6,500`) is **hardcoded on `BillsPage`**.

#### 5.6 User / auth

**Not modeled — and not planned for v1.** Local trusted app, no sign-in. `app-structure.md` mentions Auth0 as a **scaffold leftover**; `apps/web/src/main.tsx` has Query + Router only. Keep it that way until the owner reverses this.

#### 5.7 Sync (multi-device)

There is no client replication, CRDT, or offline write log.

```
Intended:
  Web upload  -->  client POST  -->  store file + ImportJob
              -->  processor parse  -->  Account / Transaction / Holding / Bill
  Web analysis <-- GET /v1/...  <--  Prisma reads (not fixtures)

Today:
  Web  -- VITE_API_URL unset/empty -->  fixtureClient  -->  packages/shared fixtures
       -- VITE_API_URL set        -->  GET {baseUrl}/overview|cards|banks|investments|bills
                                       Nest services --> same fixtures
                                       Prisma Account/Bill seeded, unread
                                       (SDK does not prepend /v1; baseUrl must include the prefix)
  processor  -->  BullMQ price-sync  -->  log account count; no enqueue; no parse queue
```

### 6. Feature Domains

#### 6.0 Document ingest (import → parse → persist)

_Purpose: the only confirmed way data enters the workspace._

**Purpose.** Take financial documents the household already has, parse them into structured rows, save those rows, and keep enough provenance to trust (or correct) the parse. Analysis domains below are useless as a product until this works.

**Key capabilities (shipped):** none. Statements shows **Upload statement** and **Parsed statement lines** as inert chrome. No file picker handler, no POST, no blob store, no parse worker, no `Document` model.

**Planned capabilities (required):**

- **Add account** on each section, then upload onto it (**required**)
- Upload **PDF/CSV** for bank, card, 401(k)/brokerage, utility, insurance, crypto (**required**)
- **Manual create/edit** of accounts, transactions, bills, holdings at any time (**required**)
- Store original files forever (**required**)
- Per-institution parse templates; auto-apply high confidence; review low; **ask** on overlapping re-import (**required**)
- Persist into Prisma; UI reads saved rows (**required**)
- Until real samples exist, parser work uses **synthetic fixtures**

**Planned capabilities (not yet required):** OFX/Excel/images, live prices, pay/trade, institution OAuth, mobile, search/filter polish, a unified inbox.

**Product intent.** This domain feeds every other. “4 linked” is leftover copy. Empty first-run: no demo household in the product path (fixtures may remain for tests/dev).

**Maturity:** 🔶 UI labels on Statements · ❌ Upload, parse, persist, provenance

#### 6.1 Overview (net worth)

_Purpose: one screen for “where do I stand, and what needs me this week.”_

**Purpose.** Land on `/`. Show net worth, a 12-month sparkline, cash / card balances / retirement+brokerage / crypto, allocation, attention, recent activity.

**Key capabilities (shipped, demo data):**

- Net worth `$248,410.52` and change copy
- Range chips `1M | 3M | 1Y | All` (visual; selected range is fixture `1Y`, clicks do not change data)
- Four mini metrics; allocation bar; attention list; recent activity with link to Statements
- `GET /v1/overview` returns the same snapshot

**Planned capabilities:**

- Range actually changes the series (**required** if chips stay)
- Attention computed from persisted bills, card due dates, flags (**required**)
- Activity from parsed `Transaction` rows (**required**)

**Product intent.** Overview is the weekly home after ingest. It must stay a rollup of parsed domains, not a fifth set of numbers.

**Maturity:** ✅ Page shipped · 🔶 Data fixture · ❌ Live computation / range

#### 6.2 Credit cards

_Purpose: combined spend and per-card statement health._

**Purpose.** `/cards` is all-cards spend, category mix, recurring note, and a transaction list. `/cards/:id` is statement balance, minimum, limit, utilization, rewards, 6-month bars, details (APR, autopay, fee), transactions.

**Demo accounts:** Platinum 4821, Everyday 0937, Travel 2254, Store 7710.

**Key capabilities (shipped, demo data):**

- Totals: spent, projected statements, payments due
- Category bars; static pills (1 flagged / pending 2 / recurring 8 / refunds 1)
- Per-card metrics and details
- Subtitle copy **“118 transactions”**; the combined table renders **7 fixture rows**
- `GET /v1/cards`, `/cards/overview`, `/cards/:id` (web SDK). Nest also has `GET /cards/:id/transactions` (unused by web)

**Planned capabilities:**

- Card statement import/parse (PDF/CSV upload on `/cards`) into `Transaction` + card `Account` (**required**)
- Merchant search and category `<select>` actually filter (**required** if chrome stays)
- Flag unusual spend and recurring detection against parsed history
- `Pay statement` / `Download statement` — **not required** as money movement; Download may later mean “the original imported PDF”
- `GET /cards/:id/transactions` should be per-card if it remains; today it ignores `:id`, returns the all-cards feed, and is absent from `ClientApi`

**Product intent.** Cards are both debt (net worth) and the spend feed, filled from imported card statements. Autopay copy (“statement balance from Checking 0182”) is analysis, not a pay rail. Store 7710 paying water is a cross-domain example.

**Maturity:** ✅ Analysis pages shipped · 🔶 Filters/search theater · ❌ Card-doc ingest · ❌ Payments

#### 6.3 Bank statements

_Purpose: cash, income vs spending, per-account ledgers — and the first visible capture surface for ingest._

**Purpose.** Nav label is **Statements** (`/statements`). Combined income/spend, outflow mix, account table, “parsed statement lines.” `/statements/:id` is one bank. This section is where upload/parse is already named in the UI; it is not the only document type the product will ingest.

**Demo accounts:** Checking 0182 (payroll), Joint checking 3390 (partner), Savings 6617 (emergency fund goal $15,000), High-yield savings 1158 (sinking funds: travel, car insurance, gifts).

**Key capabilities (shipped, demo data):**

- Totals: balance, Oct income, Oct spending, savings rate
- Income vs spending bars; outflow list (housing, card payments, transfers, utilities, fees)
- Account table with statement status (`Ready` / `Due Oct 31`)
- Header actions: **Export CSV**, **Upload statement** (inert)
- Per-account “Move money” / “Export CSV” (inert)

**Planned capabilities:**

- Statement upload + parse + persist on `/statements` (**required**)
- Parsed lines and account table from Prisma (**required**)
- Export CSV (of stored lines)
- Move money — **not required** in-app

**Product intent.** This domain is cash and **bank statements**. Joint + goals + sinking funds are account _subtypes_ in copy (`typeLabel`), not separate models. “4 linked” is incorrect product language; replace with imported/parsed status when ingest ships.

**Maturity:** ✅ Analysis pages shipped · 🔶 Upload/parse labels · ❌ Ingest pipeline · ❌ Live bank link (non-goal)

#### 6.4 Investments and crypto

_Purpose: invested assets and crypto in one section, with allocation and per-account holdings._

**Purpose.** `/investments` lists five accounts, allocation donut, holdings, 401(k) drift callout. `/investments/:id` varies by kind: 401(k) mix + contribution table; Brokerage A trades; Brokerage B RSU vest schedule; cold wallet + exchange sync/activity.

**Demo accounts:** `401k`, `brokerage-a`, `brokerage-b`, `cold-wallet`, `exchange`.

**Key capabilities (shipped, demo data):**

- Total invested, all-time gain, crypto unrealized
- Account table (share % is **hardcoded in the page**, not from API)
- Type chips All / 401(k) / Brokerage / Crypto (inert)
- Holdings table on the **list** page (5 of 8 holdings); donut center **`$205.2k` is hardcoded**
- Per-account details (beneficiary “On file”, FIFO, staking, recovery phrase, etc. as copy)
- Crypto **detail** pages skip the holdings table (`kind === 'investment'` required)
- `GET /v1/investments`, `/overview`, `/:id`

**Planned capabilities:**

- Import/parse of 401(k), brokerage, and crypto PDF/CSV on `/investments` into `Account` + `Holding` (+ activity) (**required**)
- Live marks via `price-sync` — **optional later**; ingest is the position source
- Type chips filter the table
- Rebalance / contribution / trade / sell / sync / copy address — **not required** as execution; 401(k) must remain non-executing unless explicitly reversed

**Product intent.** Retirement, taxable, RSUs, self-custody, and custodial crypto share a section because they are **assets in the net-worth mix**, filled from imported documents. Cold wallet vs exchange is a custody distinction in `typeLabel` / `group: crypto`, not a separate app.

**Maturity:** ✅ Analysis pages shipped · 🔶 Filters and share % · ❌ Document ingest · ❌ Price sync / trading

#### 6.5 Bills and insurance

_Purpose: recurring utilities with usage, plus premium summaries, on one calendar._

**Purpose.** `/bills` metrics (utilities monthly, insurance monthly, due in 10 days, next renewal), utility table, electricity kWh chart, three insurance cards, upcoming payments. `/bills/:id` only for utilities (electricity, internet, water, gas).

**Demo utilities:** Electricity (Checking 0182, autopay off), Internet (Everyday 0937, promo until Feb 2027), Water and sewer (Store 7710 autopay), Natural gas (Checking 0182).

**Demo insurance (cards only):** Auto 2 vehicles `$218.90/mo`, Renters `$22.50/mo`, Health `$286.00/mo` with deductible progress. Health out-of-pocket max `$1,400 of $6,500` is hardcoded on the Bills page, not on the policy type.

**Key capabilities (shipped, demo data):**

- Utility list with paid-from, due, status, last bill
- Usage (kWh / gal / therms) or internet Mbps
- Insurance summary cards
- `GET /v1/bills/overview`, `/bills/utilities`, `/bills/utilities/:id`, `/bills/insurance`

**Planned capabilities:**

- Import/parse utility bills and insurance PDF/CSV on `/bills` (**required**)
- `paidFromId` / `dueAt` persisted and used (**required**)
- Upcoming list from bills, not a fixture array
- Pay / speed test / contact support — **not required** in-app
- View bill PDF — may mean the **imported original** once files are stored
- Insurance detail pages — **not planned** unless the summary-only decision is reversed

**Product intent.** Bills are cash-flow and attention, filled from imported invoices and policy docs. Insurance is “don’t forget the premium and the renewal,” not a policy-admin system.

**Maturity:** ✅ Utility pages + insurance cards · 🔶 Prisma bill rows incomplete · ❌ Bill-doc ingest · ❌ Pay rails

#### 6.6 Search and chrome

_Purpose: find a transaction or holding without hunting sections._

Header search placeholder: “Search transactions, holdings.” Cards also has “Search merchants.” Neither is wired. Account chip “AM” has no menu.

**Maturity:** 🔶 Chrome only · ❌ Behavior

#### 6.7 Extended / future domains

| Domain | Schema / routes | Intent |
| --- | --- | --- |
| Document / ImportJob | ❌ none | Provenance for every parse. **Required** (see 6.0). |
| Parse worker | ❌ none (BullMQ exists) | Off-request-path extraction. **Required.** |
| Price sync | BullMQ `price-sync`; processor worker | Optional later refresh of holding marks. Not the source of positions. |
| Recurring & flags | UI copy + `ActivityRow.flagged` | Detect subscriptions and unusual spend **on parsed transactions**. |
| Auth / identity | None | Needed if this is more than a local demo. |
| Household sharing | Joint account copy only | Partner as member vs AM-only. |
| Goals | Savings 6617 goal $15k; HYSA 1158 “3 goals” | Account metadata in fixtures, not a `Goal` model. |
| RSU / equity | Brokerage B extra table | Vest schedule is fixture `extraTables`, not a model. |
| Billing / plans | None | No product. |
| Mobile | None | Not started. |

### 7. Platform Strategy

| Client | Role | When to use | Unique capabilities | Billing |
| --- | --- | --- | --- | --- |
| Web (`apps/web`) | **The product.** Capture (upload) and analysis (22 pages). | Always. | Upload (required, not built) + all analysis pages. Wide desktop workspace (`max-w-[1200px]`). | Would be the billing surface if monetization appears. None now. |
| API client | Accept uploads; serve analyzed data. | When `VITE_API_URL` is set. | GET-only today. **Must grow POST ingest.** Swagger `/docs`, prefix `/v1`, CORS `WEB_ORIGIN`. | — |
| API processor | Parse jobs (required) and optional price refresh. | Alongside client. | Health on `PROCESSOR_PORT`. `price-sync` is a leftover placeholder; **parse is the job that matters**. | — |
| Mobile | — | — | — | — |

Web is the **only** capture and analysis surface. Capture = document import. Analysis = the five sections. There is no mobile capture client.

#### Feature parity matrix

| Capability | Web | Target |
| --- | --- | --- |
| Browse 5 sections / 22 pages | ✅ | Keep (analysis) |
| Fixture household without API | ✅ | Keep for demos only; not the product loop |
| Upload financial documents | ❌ (button only) | **Required** |
| Parse + persist to Postgres | ❌ | **Required** |
| Analysis UI reads Prisma | ❌ (fixtures) | **Required** |
| Search | 🔶 Input only | Not v1-required |
| Filters / range / type chips | 🔶 | Not v1-required |
| Pay / move / trade | 🔶 Labels | Do not execute |
| Live institution link | ❌ | **Non-goal** |
| Auth | ❌ | **Non-goal** for v1 |
| Price sync | ❌ | Optional after ingest |
| Invite partner | ❌ | TBD |
| Mobile | ❌ | Deferred |
| Offline write sync | ❌ | Not implied |

### 8. Monetization

No model.

| Tier | Price | Unlocks |
| --- | --- | --- |
| — | — | — |

- **Billing flow:** none. No client charges.
- **Free-tier limits:** none (provisional: unlimited demo).
- **Enforcement:** TBD. No flags, no Stripe, no plan enum.

Treat any paywall, account cap, or “Pro” copy as out of spec until an owner decision is recorded in §12.

### 9. Technical Architecture (Product-Relevant)

| Layer | Choice | Product impact |
| --- | --- | --- |
| Web | Vite + React, TanStack Query, React Router | Fast SPA; all UX lives here. |
| API | Nest Fastify `client` + `processor` | Client: upload + reads. Processor: **parse** (required) and optional price refresh. |
| Contract | `packages/shared` types + fixture objects | UI and API share one snapshot shape (formatted strings). Switching to numeric API responses is a product-visible change. |
| SDK | Hand-written `createClient({ baseUrl })` | Unset/`""` `VITE_API_URL` → fixtures (`if (baseUrl)`). Live paths are `/overview`, not `/v1/overview`. Generate script is a console stub (`/v1/docs-json` is not a real route; Swagger is `/docs`). |
| DB | Postgres via Prisma | **System of record for parsed data (confirmed).** Today: connect-only `PrismaService`; seed unread. Missing: `Document` / import job. |
| Cache / jobs | Dragonfly + BullMQ | The process that should run **parse**. Today: unused `price-sync` queue, no enqueue. |
| Money | `decimal.js` + Prisma Decimal | Correct arithmetic when totals are computed; UI does not compute yet. |
| Auth | None | Anyone who can hit web or `/v1` sees the household. |

**Collections**

| Collection | In Prisma | Seeded | Served to UI | Notes |
| --- | --- | --- | --- | --- |
| Document / ImportJob | ❌ | — | — | **Required** for ingest provenance |
| `Account` | ✅ | ✅ (from fixtures) | Via fixtures, not query | Should be created/updated by parse |
| `Transaction` | ✅ | ❌ | Fixtures | **Required** parse output |
| `Holding` | ✅ | ❌ | Fixtures | **Required** parse output for investments/crypto |
| `Bill` | ✅ | ✅ (partial; no `paidFromId`/`dueAt`) | Fixtures | **Required** parse output for utilities/insurance |
| Attention, allocation, series, rewards, APR, RSU vest, usage, health OOP | ❌ | n/a | Fixtures / page hardcodes | Derive from parsed rows where possible |

`PrismaService` logs that missing `DATABASE_URL` means “domain services will use fixtures,” but services import `shared` even when `isReady` is true. Shared `AccountKind` is kebab-case; Prisma is `CREDIT_CARD` / `BANK` / `INVESTMENT` / `CRYPTO` — seed maps between them.

### 10. User Journeys

**1. First-time user**

**Today:** `pnpm dev:web` → Overview already full of demo AM. No empty state, no upload.

**Intended (confirmed loop):**

1. Open web → **empty** workspace (no demo AM).
2. Add an account on a section (name/type).
3. Upload a PDF/CSV onto that account, **or** type the rows by hand.
4. High-confidence parse saves; low-confidence is reviewed; overlapping re-import **asks**. Original is kept.
5. Overview shows those numbers. No sign-in.

**2. Inviting a collaborator**

Out of scope. Joint 3390 is an account label, not a second user.

**3. Core weekly loop (intended)**

1. On the relevant account, import this period’s PDF/CSV (or type a correction).
2. Review only if the parse is low-confidence, or if a re-import overlaps — then the app **asks**.
3. Open Overview → net worth and Needs attention from stored rows.
4. Drill as needed. Originals remain available (re-download / re-parse).
5. Stop. No pay, no trade.

**Today:** steps 3–4 against fixtures; steps 1–2 missing.

**4. Upgrading**

Does not exist. No checkout, no plan, no limit.

### 11. Current State vs. Roadmap

#### 11.1 Shipped

- 22-page **analysis** IA: Overview, Cards (+4), Statements (+4), Bills (+4 utilities), Investments (+5)
- Coherent **demo** household (net worth, cross-account pays, attention) — not parsed from files
- Ingest loop (upload / parse / persist) — **not shipped**
- Insurance as summary cards only (no detail routes) — intentional
- Crypto under Investments — intentional
- Shared types + fixtures as the contract
- GET API mirroring that contract; health endpoints; Swagger 0.1.0
- Prisma schema + initial migration + seed of `Account` and `Bill`
- `price-sync` queue name and placeholder worker (no producer)
- Overview test asserts fixture net worth; AccountService test asserts four cards from fixtures

#### 11.2 Near-term roadmap

Priorities 1–4 are **owner-ranked by the confirmed loop**. The rest is still inferred from the scaffold.

| Priority | Item | Notes |
| --- | --- | --- |
| 1 | Empty states + **Add account** + per-account PDF/CSV upload | Cards, Statements, Bills, Investments. Keep originals. |
| 2 | Manual create/edit of accounts, transactions, bills, holdings | First-class path, not only parse fallback. |
| 3 | `Document`/`ImportJob` + parse worker | Templates when samples exist; synthetic until then. Confidence review; ask on overlap. |
| 4 | Write to Prisma; analysis UI reads it | Existing 22 pages are v1 analysis. |
| 5 | Per-institution templates | Blocked on real sample files; owner will provide later. |
| 6 | Resolve non-ingest action buttons | Pay / move / trade: do not execute. Upload: wire (priority 1). Search/filters are **not** v1-required. |
| 7 | Fix or drop `GET /cards/:id/transactions` | Ignores `:id`, not on the SDK, unused by web. |
| 8 | Sibling platform docs | `docs/WEB.md`, `docs/DESIGN.md`. |

#### 11.3 Deferred / watch list

- Live institution linking (Plaid-class)
- Mobile client
- Monetization / plans
- In-app payments, transfers, trades, rebalance execution
- Insurance policy detail pages
- Multi-workspace tenancy
- True offline-first sync
- Auth0 (mentioned only in the generic blueprint)
- OpenAPI-generated SDK
- Envelope budgeting (sinking funds are a savings account in the demo, not a budget product)
- Credit monitoring, tax software
- `price-sync` until ingest actually produces holdings
- OFX/QFX, Excel, and image/photo ingest (v1 is PDF + CSV)
- Search, range, and filter chrome (v1 analysis is the existing pages on real rows)
- Receipt/photo OCR
- Sign-in / Auth0
- Other households / partner login

### 12. Product Decisions (Resolved)

Decisions 1–16 are from code/README/Swagger. **17–20 are owner direction (loop).** **21–30 are owner answers, 26 Oct 2026.**

| # | Question | Decision |
| --- | --- | --- |
| 1 | What is the product? | A household finance **workspace** whose job is import → parse → persist → analyze: cards, banks, investments/crypto, recurring bills. |
| 2 | What is the only user client? | Web (`apps/web`). |
| 3 | How is navigation split? | Five items: Overview, Cards, Statements, Bills, Investments (header order). README prose lists Investments before Bills — **the header is the IA**. Crypto is not a nav item. |
| 4 | Where does crypto live? | `AccountKind.CRYPTO`, routes under `/investments`. |
| 5 | Insurance depth? | Summary cards on Bills only; Swagger: “Insurance policies (summary cards only).” No `/bills/:id` for policies. |
| 6 | Mutating HTTP today? | GET only. **Product requires POST ingest**; it is not built. |
| 7 | Default web data source? | Fixtures via SDK when `VITE_API_URL` is unset. |
| 8 | Account taxonomy? | Four kinds: credit card, bank, investment, crypto. Bills: utility vs insurance. |
| 9 | Default currency? | USD (`Account.currency` default). |
| 10 | Auto-trade / auto-rebalance? | No. Fixture callout: no trades placed automatically. |
| 11 | Execute payments in-app? | Not implemented; buttons are inert. Do not treat labels as a live rail. |
| 12 | Auth on API? | None. No guards. **Confirmed:** no sign-in for v1 (local trusted app). |
| 13 | Monetization? | None in repo. |
| 14 | Demo household shape? | 4 cards, 4 banks (incl. joint), 3 investment + 2 crypto, 4 utilities, 3 insurance policies. |
| 15 | Money math library? | `decimal.js` (half-up, high precision), not IEEE floats. |
| 16 | Processor vs client? | Client serves REST (and future upload); processor is workers + health. No domain REST on processor. Parse belongs on the processor. |
| 17 | How does data enter the system? | **Import financial documents, parse them, save to the database.** Not live institution link. |
| 18 | What is the UI for? | **Analyze** the saved data (the 22 pages). |
| 19 | What is the system of record? | **Postgres via Prisma.** Fixtures are demo-only. |
| 20 | Does ingest include more than bank PDFs? | **Yes.** v1 kinds: bank, cards, 401(k)/brokerage, utilities, insurance, crypto. |
| 21 | Who is the user? | **JH only** — local household tool, not a multi-tenant product. |
| 22 | File formats (v1)? | **PDF and CSV.** Not OFX, Excel, or images. |
| 23 | Parse review? | **Auto-save when confidence is high; review when low.** |
| 24 | Keep original files? | **Yes, forever** (re-download / re-parse). |
| 25 | Where is upload? | **Per section**, onto an account you already added. Not a global inbox. Overview is analysis-only. |
| 26 | First run? | **Empty workspace.** Add account first, then upload or type. Demo AM is not product first-run. |
| 27 | Manual entry? | **Anytime** — accounts, transactions, bills, holdings — not only when parse fails. |
| 28 | Sign-in? | **None for now.** Local trusted app. |
| 29 | Is the 22-page UI enough analysis for v1? | **Yes** — wire it to the database. New analysis views are not v1. |
| 30 | Partner / sharing? | **No.** Joint accounts are data, not a second login. |
| 31 | First account creation? | **Add account shell** (name/type), then upload onto it. The file does not create the account. |
| 32 | Parser? | **Per-institution templates.** Sample files later; use synthetic fixtures until then. |
| 33 | Overlapping re-import? | **Ask each time.** |

### 13. Open Questions

| # | Question | Why it matters |
| --- | --- | --- |
| 1 | ~~JH vs other households?~~ | **Resolved §12.21:** JH only. |
| 2 | ~~Workspace membership?~~ | **Resolved:** one implicit local household; no User table required for v1. |
| 3 | ~~Partner sign-in?~~ | **Resolved §12.30:** no. |
| 4 | ~~Ingest path?~~ | **Resolved §12.17.** |
| 5 | ~~Auth?~~ | **Resolved §12.28:** none. `/v1` staying open is acceptable on a trusted machine; still do not bind it to the public internet without revisiting. |
| 6 | ~~Prisma as source of truth?~~ | **Resolved §12.19.** |
| 7 | Should the API keep sending preformatted display strings, or raw amounts + dates? | Implementation; not blocking ingest IA. |
| 8 | Which **non-upload** action buttons stay as dead chrome vs get removed? | Pay, move, trade, sell, sync, copy address, speed test. View PDF = original file (§12.24). |
| 9 | Price vendor for `price-sync`? | Optional after ingest. |
| 10 | Is 70/30 401(k) target user-defined? | Drift callout source. |
| 11 | Multi-currency? | Field exists; UI is USD-only. |
| 12 | ~~Monetization?~~ | **Resolved:** none. Personal tool. |
| 13 | ~~Mobile?~~ | **Resolved:** not v1. |
| 14 | Search/filters? | **Not v1-required** (§12.29). Dead chrome can stay or be removed. |
| 15 | Recurring detection and unusual-spend flags? | Nice once parsed history exists; not the ingest MVP. |
| 16 | ~~Parse pipeline exists as intent?~~ | **Resolved.** How: §27. |
| 17 | Goals as a model? | Not v1 unless a statement implies them. |
| 18 | RSU vest schedule as a model? | Parse from brokerage docs if present; otherwise leave. |
| 19 | Health deductible / OOP from imported plan docs? | Insurance ingest is in v1 kinds; PHI still applies locally. |
| 20 | Feature flags? | None needed for a single-user local app. |
| 21 | ~~Demo vs empty first-run?~~ | **Resolved §12.26:** empty. Fixtures stay for tests/dev. |
| 22 | Must `VITE_API_URL` include `/v1`? | Engineering. |
| 23 | “118 transactions” copy? | Moot once parsed rows drive the table. |
| 24 | Unused service methods? | Engineering. |
| 25 | Crypto detail holdings table? | Small UI gap; ingest still writes `Holding`. |
| 26 | ~~File types?~~ | **Resolved §12.22:** PDF + CSV. |
| 27 | ~~Parser approach?~~ | **Resolved §12.32:** per-institution templates. Blocked on real samples. |
| 28 | ~~Review before save?~~ | **Resolved §12.23.** |
| 29 | ~~Retain originals?~~ | **Resolved §12.24:** forever. Where on disk/S3 is engineering (local disk is enough for a single-machine app). |
| 30 | ~~Inbox vs per-section?~~ | **Resolved §12.25.** |
| 31 | ~~Account matching?~~ | **Mostly resolved §12.31:** you pick the account by adding it, then uploading onto it. Still: uploading the wrong file type onto an account (card PDF onto a bank). |
| 32 | ~~Overlapping re-import?~~ | **Resolved §12.33:** ask. |
| 33 | ~~First file creates account?~~ | **Resolved §12.31:** add shell first. |
| 34 | ~~Manual without a document?~~ | **Resolved §12.27:** yes, anytime. |
| 35 | Where are original files stored (app data dir vs user-picked folder)? | Local tool; default can be app data. |
| 36 | Add-account fields for v1? | Name + kind are implied. Mask, institution, currency, opening balance — not confirmed. |
| 37 | Upload on the section list, the account detail page, or both? | Implied: detail page (upload *onto* an account). List needs Add account. |

### 14. Non-Goals (Explicit)

- Operating as a bank, broker-dealer, or bill-pay network
- Live institution aggregation (Plaid-class OAuth) as the way data enters
- Placing 401(k) or brokerage trades automatically
- Insurance policy administration or claims
- Tax preparation or official tax-lot software (download button is not a product)
- Credit scoring, loan origination, or card applications
- Being a crypto exchange or wallet custodian (cold wallet is tracked, not held)
- Kids’ accounts, chores, or allowance
- Social feeds or public net-worth pages
- Other households, sign-up, or multi-tenant workspaces
- Partner login
- Sign-in
- A second user client (mobile, desktop)
- SaaS packaging, trials, or usage-based billing
- Replacing issuer/broker apps for disputes, 2FA, or wire origination
- Envelope/zero-based budgeting as a primary IA

### 15. Compliance & Privacy (Watch List)

**No special requirements are implemented now** because there is no real user data, no auth, and no payments. **Revisit on the first real upload** — ingest is the confirmed path.

| Area | Now | Revisit when |
| --- | --- | --- |
| Financial documents | None stored | First upload: originals kept forever on the local machine; encryption/backup still worth doing even for a single user |
| Auth / PII | None, and **not planned** | If the API is ever exposed beyond localhost |
| PCI | Not a card processor; no PAN | If pay-by-card is ever in-app (not the default) |
| Health | Deductible / OOP on a health policy card | If real plan data is stored (PHI) |
| Household / partner | Joint account label | If a second person can see AM’s cards/401(k) |
| Kids | None | If custodial accounts appear |
| Crypto | Self-custody copy (“recovery phrase backed up: Yes”) | Do not store seed phrases; address display policy |
| Billing | None | If paid plans exist |

Default stance: this app **stores imported documents and the rows parsed from them**. It does not move money. Keep it that way unless §12 is updated.

### 16. Related Documentation

| Doc | Path | Status |
| --- | --- | --- |
| This spec | `docs/JH-FINANCE.md` | Canonical product intent |
| Web client | `docs/WEB.md` | Run / extend / deploy `apps/web` (Vite SPA, fixtures vs `VITE_API_URL`) |
| Design | `docs/DESIGN.md` | Current UI/UX as implemented (tokens, shell, screens, gaps) |
| Mobile | `docs/MOBILE.md` | **Do not write** until there is a mobile client |
| Repo blueprint | `app-structure.md` | Structural; not product. Mentions Auth0/dashboard from the template — ignore as JH Finance product. |
| Runbook / pages | `README.md` | 22-page map and how to run web vs API |
| API client | `docs/API-CLIENT.md` | Nest HTTP process (`:3000`, GET fixtures, Swagger `/docs`) |
| API processor | `docs/API-PROCESSOR.md` | Nest worker (`:3001` health; `price-sync` placeholder, no producer) |

### 17. Revision History

| Date | Change |
| --- | --- |
| 2026-10-26 | Initial spec from codebase review (web pages, shared fixtures/types, Nest GET API, Prisma schema/seed, processor placeholder). No product-owner interview. |
| 2026-10-26 | Follow-up: Prisma connect-only, no `price-sync` producer, SDK omits `/v1`, cards 118 vs 7 rows, crypto detail holdings omitted, leftover GET helpers. |
| 2026-10-26 | Owner direction: core loop is import financial docs → parse → save to DB → analyze in the UI. Ingest is required; live institution link is a non-goal. |
| 2026-10-26 | Owner answers: JH-only local app; v1 PDF+CSV on every section; empty first-run; keep originals; low-confidence review; manual fallback; no auth; 22 pages are v1 analysis. |
| 2026-10-26 | Owner answers: add account then upload; manual entry anytime; per-institution templates (samples later); ask on overlapping re-import. |

This spec reflects confirmed direction **as of 26 Oct 2026**. Build order: empty states and account CRUD, then upload+store, then templates when samples exist, with manual entry available throughout. Fixtures are for tests/dev, not first-run.
