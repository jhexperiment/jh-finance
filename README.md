# jh-finance

JH Finance is a personal finance workspace for tracking everything you own and owe in one place: credit cards, bank accounts, retirement and brokerage investments, crypto, and recurring bills.

It has 22 pages in five sections:

Overview: Net worth ($248,410.52), cash, card balances, retirement and brokerage totals, crypto, asset allocation, a “needs attention” list, and recent activity across accounts.
Credit cards: Spending by category, a combined transaction list with a card filter, and upcoming payments. Each of the four cards (Platinum 4821, Everyday 0937, Travel 2254, Store 7710) has its own breakdown page.
Bank statements: Income and spending over time, where the money went, and a table of all four accounts. Each account (Checking 0182, Joint 3390, Savings 6617, High-yield savings 1158) has its own page.
Investments and crypto: A summary of all five accounts with allocation charts and holdings. Each account has its own page: 401(k), Brokerage A, Brokerage B (company shares), Cold wallet, and Exchange account.
Bills and insurance: Utilities (electricity, internet, water and sewer, natural gas) with usage and payment history, plus auto, renters, and health insurance summaries. Each utility has its own page. The insurance policies appear as summary cards only, without individual pages.

## Run locally

Requires Node `v24.4.0` (see `.nvmrc`) and pnpm `10.28.2`.

```bash
nvm use
corepack enable
pnpm install
pnpm dev:web
```

The web app is a Vite + React workspace at [http://localhost:5173](http://localhost:5173). It uses design fixtures from `packages/shared` until `VITE_API_URL` points at the Nest client.

Optional API + database:

```bash
cp .env.example .env.local
docker compose up -d postgres dragonfly
pnpm prisma:generate
pnpm prisma:migrate:local
pnpm dev:api:client:local
pnpm dev:api:processor:local
```

Layout: `apps/api` (Nest client + processor), `apps/web` (Vite), `apps/dragonfly` (cache env), `packages/shared`, `packages/client-api-sdk`. See `app-structure.md`.