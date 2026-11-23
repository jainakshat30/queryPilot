# QueryPilot

QueryPilot is a Natural Language to SQL (Text-to-SQL) engine built from scratch. It translates plain English business questions into safe, optimized PostgreSQL 18 queries, executes them against an e-commerce database using a read-only role, and returns both structured data and human-readable explanations.

---

## Architecture & Security Model

QueryPilot uses a **Defense-in-Depth** security architecture:

1. **Dual-Database Roles**:
   - `qp_sales` (accessed by role `qp_reader`): A strictly read-only role (`GRANT SELECT ONLY`). Even if an LLM hallucinates `DROP` or `DELETE`, PostgreSQL refuses execution.
   - `qp_app` (accessed by role `qp_app`): Storage for application history, metrics, and evals.
2. **Application-Level Guardrails**:
   - `assertReadOnlySql`: Rejects non-`SELECT` statements, dangerous DDL/DML keywords (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, etc.), and multi-statement queries separated by semicolons.
3. **Session Statement Timeout**:
   - `SET statement_timeout = 5000`: Queries taking longer than 5 seconds are terminated automatically to prevent runaway CPU loads.
4. **Offline First**:
   - Supports both an offline deterministic `fake` LLM provider (0 API costs, works offline) and live AI providers (Anthropic Claude).

---

## Directory Structure

```
queryPilot/
├── scripts/                   # Database maintenance & CLI scripts
│   ├── init-db.ts             # Creates databases & roles with permissions
│   └── seed-db.ts             # Seeds sample e-commerce data
├── src/
│   ├── app/                   # Next.js App Router (UI & API routes)
│   │   ├── api/[[...route]]/  # Catch-all Hono adapter
│   │   └── page.tsx           # Web UI
│   └── server/                # Application backend
│       ├── api.ts             # Hono router (/api/query, /api/generate, /api/execute)
│       ├── env.ts             # Validated environment configuration
│       ├── ai/
│       │   ├── prompts.ts     # Schema DDL, few-shot examples, system prompt
│       │   └── generate.ts    # AI SQL generation service (fake + Claude)
│       └── db/
│           ├── schema.ts      # Drizzle ORM e-commerce schema
│           └── client.ts      # Safe read-only pool & executor
├── tests/
│   └── integration/           # Integration tests
├── docker-compose.yml         # PostgreSQL 18 container
├── drizzle.config.ts          # Drizzle Kit configuration
└── vitest.config.ts           # Vitest configuration
```

---

## Getting Started

### 1. Environment Setup
Copy [.env.example](.env.example) to `.env`:
```bash
cp .env.example .env
```
Fill in or generate random secure passwords for the database roles.

### 2. Start PostgreSQL
```bash
pnpm db:up
```

### 3. Initialize & Seed Database
```bash
pnpm db:init    # Creates databases and sets up qp_reader / qp_app roles
pnpm db:push    # Pushes Drizzle schema to qp_sales
pnpm db:seed    # Populates sample e-commerce data
```

### 4. Run Development Server
```bash
pnpm dev
```

### 5. Run Tests & Typechecks
```bash
pnpm typecheck  # TypeScript type verification
pnpm test       # Unit tests (Vitest)
pnpm test:int   # Integration tests
```
