# Task 7 — Expense Structure & Cost Behavior

## Scope

Task 7 defines the reusable expense structure for each business. It does not collect monthly amounts yet; monthly financial entry remains Task 8.

Each expense item belongs to exactly one business and has:

- a custom name;
- one expense category;
- one cost behavior;
- an active/inactive state;
- an immutable creation request ID used for idempotent create delivery.

## Expense categories

Exactly four categories are supported:

1. `acquisition` — acquisition, marketing, and sales costs used to win customers.
2. `fulfillment` — costs required to deliver or service customers.
3. `overhead` — admin, management, software, rent, accounting, and operations.
4. `financial` — financial costs such as payment processor fees and taxes.

Users can create any custom expense item inside one of these four categories.

## Cost behavior

Exactly three behaviors are supported:

1. `fixed_monthly` — a monthly fixed cost. It is not a variable cost for Contribution Profit.
2. `per_customer` — a variable cost linked to customers.
3. `percentage_revenue` — a variable cost linked to revenue.

`per_customer` and `percentage_revenue` are variable costs. `fixed_monthly` is not.

This distinction is structural only in Task 7. Task 7 deliberately stores no monthly amount, per-customer amount, or percentage rate. Those financial values are entered in Task 8 and calculated centrally in later tasks.

## Financial meaning preserved

Later financial logic must preserve these definitions:

- Contribution Profit = Net Cash Collected − variable costs.
- Variable costs are expense items whose behavior is `per_customer` or `percentage_revenue`.
- Fixed monthly costs are excluded from Contribution Profit.
- Fixed monthly costs still belong in Real Net Profit when the calculation engine is implemented.
- Refunds are revenue reductions and must never be represented as expense items.

## Access and lifecycle

- Admin can read and manage expense items for all businesses.
- A business owner can read and manage expense items for their own business.
- A business member can read expense items for that business but cannot create or update them.
- Other Mentees cannot read or modify the business expense items.
- Authorization is enforced by PostgreSQL RLS through the existing business access boundary.
- Authenticated users have no hard-delete permission for expense items.
- Deactivation preserves rows for future history and monthly-data linkage.

## Creation idempotency

- New expense creation requires a UUID `creation_request_id`.
- `(business_id, creation_request_id)` is unique in PostgreSQL.
- The request ID cannot be changed after creation.
- A duplicate delivery of the same create request is treated as success.
- The request ID is an idempotency key, not an authorization credential. RLS on `business_id` remains the security boundary.

## UI

Route: `/businesses/[businessId]/expenses`

The page must:

- render in Arabic RTL;
- explain the three cost behaviors in non-accounting language;
- explain all four expense categories;
- allow owners/Admins to create, edit, deactivate, and reactivate expense items;
- retain inactive items instead of deleting them;
- clearly mark fixed versus variable cost behavior;
- avoid asking for any financial amount in Task 7;
- remain usable without horizontal overflow at 390px width.

## Verification

Task 7 is complete only when:

- category and behavior parsing tests pass;
- a numerical classification test proves fixed costs are excluded from the variable-cost subtotal while per-customer and percentage-of-revenue costs are included;
- database-backed tests cover owner, cross-tenant, member, and Admin access;
- invalid categories and behaviors are rejected by PostgreSQL;
- duplicate create delivery cannot create a second item;
- creation request IDs are immutable;
- authenticated hard delete is blocked;
- lint, typecheck, build, and existing tests pass;
- Arabic RTL browser verification covers create, edit, deactivate, and mobile overflow.
