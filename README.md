# TEC2 — Legacy Code Analysis, Testing, and Refactoring

Refactoring of a legacy **institutional travel request processing** codebase while
preserving observable behavior and reorganizing the solution into layers
(domain, application, and infrastructure), with PostgreSQL persistence.

The official assignment statement is in [`docs/tec2-aval.md`](docs/tec2-aval.md). This README is
an operational guide and technical decisions reference — it does not replace the assignment
statement.

## Team

- **Matheus Araújo Carvalho**
- **Francisco da Chagas Correia Neto**

## Requirements

- Node.js 22
- npm
- Docker (PostgreSQL persistence only)

## Setup

```bash
npm install
```

## Verification (typecheck and tests)

```bash
npm run typecheck     # strict TypeScript, no emit
npm test              # all tests (Vitest)
npm run test:original # behavior preservation tests only
```

Infrastructure tests (`tests/infra/`) require an available database. Without `DATABASE_URL`
set, they are **automatically skipped**, so `npm test` succeeds even without Docker.

## Database (PostgreSQL)

Database infrastructure is provided via Docker Compose. Connection uses the `DATABASE_URL`
environment variable.

```bash
cp .env.example .env      # optional: keep the URL in your local environment
npm run db:up             # start PostgreSQL (docker compose)
npm run db:init           # create the travel_requests table (database/init.sql)
npm run db:down           # stop the database and remove the volume
```

To run infrastructure tests against the real database, export the URL before running tests:

```bash
# bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/travel_requests"
npm test

# PowerShell
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/travel_requests"
npm test
```

With `DATABASE_URL` set, each call to `processTravelRequest` also persists the processed
request in the `travel_requests` table.

### Inspecting records in the database (terminal)

With Docker running (`npm run db:up`), list records via `psql` inside the container:

```bash
# bash — check the container name with: docker ps
docker exec -it 20261-tec2-aval-postgres-1 psql -U postgres -d travel_requests \
  -c "SELECT id, status, travel_days, total_amount_in_cents FROM travel_requests;"
```

```powershell
# PowerShell
docker exec -it 20261-tec2-aval-postgres-1 psql -U postgres -d travel_requests -c "SELECT id, status, travel_days, total_amount_in_cents FROM travel_requests;"
```

Suggested flow to validate persistence:

```powershell
copy .env.example .env
npm run db:up
npm run db:init
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/travel_requests"
npm test
docker exec -it 20261-tec2-aval-postgres-1 psql -U postgres -d travel_requests -c "SELECT id, status, travel_days, total_amount_in_cents FROM travel_requests;"
```

After `npm test` with `DATABASE_URL`, infrastructure tests leave sample rows (ids
`TR-TEST-*`) in the table for manual inspection in the terminal.

To clean up test records locally:

```sql
DELETE FROM travel_requests WHERE id LIKE 'TR-TEST%';
```

## Architecture

```text
src/
  main.ts                    # public contract + dependency composition
  original/                  # legacy code (preserved, untouched)
  domain/                    # pure business rules (no I/O)
    travel-date.ts           #   date validation and arithmetic
    travel-validator.ts      #   field validation and error order
    travel-pricing.ts        #   daily rates, subtotal, and total
    travel-status.ts         #   status and warnings
    travel-analysis.ts       #   domain orchestrator (aggregates rules)
  application/
    ports/
      travel-request-repository.ts   # repository interface (port)
    process-travel-request-use-case.ts # use case
  infra/
    database/pg-client.ts            # pool creation via DATABASE_URL
    repositories/
      postgres-travel-request-repository.ts # SQL implementation of the port
```

Dependencies point **inward**: infrastructure depends on the port defined in application
(dependency inversion), and the domain does not know about application, infrastructure,
`pg`, Docker, or `process.env`. The full diagram is in
[`docs/dependency-diagram.pdf`](docs/dependency-diagram.pdf).

## Technical decisions

1. **Synchronous signature preserved.** `processTravelRequest(input): TravelRequestOutput`
   remains synchronous (contract required by behavior preservation tests). Persistence runs
   as *fire-and-forget* inside the use case: the result is returned immediately and the
   write happens in the background, with isolated error handling.
2. **What is persisted.** We store input data plus the analysis result (`status`, `travelDays`,
   amounts). The `errors` and `warnings` fields are **not** persisted because the provided
   `travel_requests` table has no matching columns — they belong to the output contract, not
   the historical record.
3. **Persistence regardless of status.** Every processed request is saved (`approved`,
   `pending-review`, or `rejected`) as analysis history. Reprocessing the same `requestId`
   updates the record (`INSERT ... ON CONFLICT (id) DO UPDATE`).
4. **Dependency injection in `main.ts`.** The PostgreSQL repository is only created when
   `DATABASE_URL` is set; otherwise, the use case runs without persistence. This keeps the
   public contract testable without requiring a database.
5. **Validation order preserved.** Error messages and their order match the legacy code,
   ensuring compatibility with behavior preservation tests.
6. **Legacy untouched.** `src/original/` remains as reference and is no longer called by
   `src/main.ts` after refactoring.

## Critical use of Artificial Intelligence

- **Tool used:** Claude Code (Anthropic, Claude Opus model) as an assistant for planning,
  code generation, and tests.
- **How it was used:** supported legacy mapping, layered architecture proposal (documented in
  [`docs/plano-desenvolvimento.md`](docs/plano-desenvolvimento.md)), and incremental code and
  test writing by phase.
- **Suggestions accepted:** extracting rules into the domain mirroring the legacy code; use
  case as a class to allow repository injection; *fire-and-forget* persistence to avoid
  breaking the synchronous signature; infrastructure tests with `skipIf` when no database is
  available.
- **Suggestions rejected or modified:** creating the repository interface before there was
  real use was deferred to avoid a decorative layer (the port was introduced only when
  persistence started consuming it); the decision not to persist `errors`/`warnings` was
  reviewed manually against the provided schema.
- **How we validated:** every suggestion was checked with `npm run typecheck` and `npm test`,
  requiring behavior preservation tests (`tests/original/`) to keep passing at each step;
  persistence was verified by running infrastructure tests with the database active via
  Docker.

## Known limitations

- Persistence is *best-effort* (*fire-and-forget*): a write failure is logged but does not
  interrupt the analysis response, by design to keep the synchronous signature.
- Infrastructure tests require PostgreSQL accessible via `DATABASE_URL`; without it, they are
  skipped.
