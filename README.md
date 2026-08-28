# Mizan — ميزان

Arabic-first financial decision-support for coaches, consultants, creators, and education businesses.

## Release state

The implementation roadmap through **Task 39** is complete on `main`. The application now includes the scheduled authentication/roles model, Supabase-backed tenant isolation and RLS, business setup and monthly data entry, financial calculations and dashboards, funnel/customer/LTV analysis, scenarios, Admin/Mentee workflows, Arabic RTL/responsive polish, metric auditability, and the final security review.

**Task 40 — Production Deployment & Final Verification** is the release-closure task. It adds no new product feature; it verifies the exact production commit, records the release evidence, and closes only after the post-merge `main` pipeline and Vercel production deployment are both green.

See `docs/releases/TASK_40_PRODUCTION_FINAL_VERIFICATION.md` for the final release gate and evidence.

## Local development

Requirements:

- Node.js 22.6+
- npm

```bash
npm ci
npm run dev
```

Copy `.env.example` to `.env.local` and provide the required Supabase/application values. Never commit real credentials.

## Quality and release checks

Static checks:

```bash
npm run check
```

### Full automated test suite

`npm test` includes the database-backed RLS/security attack matrix. In addition to Node/npm, it requires:

- PostgreSQL available on the literal loopback host `127.0.0.1` and port `5432`;
- a disposable database whose name ends in `_test` (the CI database is `mizan_test`);
- the `psql` client available on `PATH`;
- `RLS_TEST_DATABASE_URL` pointing only at that disposable local test database.

Example local test database with PostgreSQL credentials matching CI:

```bash
docker run --name mizan-postgres-test --rm \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=mizan_test \
  -p 5432:5432 \
  postgres:17-alpine
```

In another shell, with `psql` installed:

```bash
export RLS_TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/mizan_test'
npm test
```

The RLS runner intentionally refuses remote/non-loopback targets, non-5432 ports, and database names that do not end in `_test` because its setup is destructive and must only run against a disposable local database.

### Production build

```bash
npm run build
```

### Browser verification

Install the Chromium browser used by Playwright, then run browser verification after the production build:

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

The GitHub `Task verification` workflow provisions PostgreSQL and Chromium automatically and runs the complete release sequence on pull requests and again on pushes to `main`, including production dependency audit, static checks, tests/security matrices, production build, mutation check, and Chromium browser verification.
