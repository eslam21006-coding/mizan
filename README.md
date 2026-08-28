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

Full unit/business/auth/database-security suite:

```bash
npm test
```

Production build:

```bash
npm run build
```

Browser verification after a production build:

```bash
npm run test:e2e
```

The GitHub `Task verification` workflow runs the complete release sequence on pull requests and again on pushes to `main`, including production dependency audit, static checks, tests/security matrices, production build, mutation check, and Chromium browser verification.
