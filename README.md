# Mizan — ميزان

Arabic-first financial decision-support for coaches, consultants, creators, and education businesses.

## Current scope

Development is intentionally task-by-task.

- Task 1: calculation specification — completed.
- Task 2: application shell — Next.js, TypeScript, Arabic RTL, responsive navigation, design tokens, and deployment-ready structure.
- Authentication, roles, Supabase RLS, financial data entry, and calculation implementation are deliberately deferred to their scheduled tasks.

## Local development

Requirements:

- Node.js 20.9+
- npm

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run check
npm run build
```

Copy `.env.example` to `.env.local` only when Supabase wiring begins. Never commit real credentials.
