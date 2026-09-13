# Mizan — ميزان

Arabic-first financial decision-support for coaches, consultants, creators, and education businesses.

## Release state

The original implementation roadmap through **Task 40** is complete. After that release, founder-testing and customer-economics hardening continued through PR **#75**, including raw payment-gateway import improvements, transaction-derived customer counts, customer-ledger and Observed LTV UX work, automatic Customer Economics allocation, automatic Lifetime Contribution Profit, profitability review/corrections, and downstream Decision Engine integration.

The current post-batch release baseline is `main` commit `54c5d498a9870fdf2f7880c8ec9860462bdfe2dd` (merge of PR #75). Its post-merge `Task verification` workflow run **34744428445 / #771** completed successfully.

The remaining release-closure work is documentation and exact-production verification only. No new product behavior is part of that release task. After the release-record PR is merged, the resulting exact `main` commit must pass the full `Task verification` pipeline and be confirmed as the production deployment before the batch is considered closed.

See `docs/releases/POST_BATCH_PRODUCTION_FINAL_VERIFICATION.md` for the current release gate and evidence. `docs/releases/TASK_40_PRODUCTION_FINAL_VERIFICATION.md` remains the historical record for the original Task 40 release.

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
