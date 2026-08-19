# Task 8 — Monthly Data Entry

## Scope

Task 8 stores the raw monthly actuals that later financial calculations consume. It does not calculate or display Net Cash, profit, margin, CAC, MER, contribution metrics, comparisons, or dashboard KPIs. Those calculations begin in Task 9.

The primary reporting/storage cadence is one calendar month per business.

## Monthly inputs

A month contains seven input areas:

1. Revenue
2. Refunds
3. Customers
4. Acquisition
5. Fulfillment
6. Overhead
7. Financial costs

### Revenue and refunds

Configured revenue streams are reused from Task 6.

For each stream, Task 8 may store:

- Gross Cash Collected for the month;
- Refunds for the month.

Both are non-negative raw inputs. A value may be explicitly zero or unavailable (`null`). Zero and missing are not interchangeable.

The monthly period also supports:

- unallocated Gross Cash Collected;
- unallocated Refunds;
- an optional adjustment note.

The unallocated Gross Cash Collected and unallocated Refunds fields follow the same zero-versus-missing rule as stream amounts: leaving a field blank stores `null`, while entering `0` stores an explicit zero. Task 9 must not interpret a missing value as an entered zero.

These fields are for actual cash/refunds that the user cannot reliably assign to a configured revenue stream. They are not a second copy of a stream amount and they do not perform a calculation in Task 8.

Refunds remain contra-revenue. They must never also be entered as an expense.

### Customers

Task 8 stores:

- `new_customers`;
- `total_paying_customers`.

Both may be unavailable. When present they must be non-negative integers. When both are present, `new_customers <= total_paying_customers` is mandatory.

### Expenses

Task 8 reuses the expense items defined in Task 7.

The stored monthly input depends on the item's behavior:

- `fixed_monthly`: monthly amount;
- `per_customer`: unit cost plus an explicit count basis;
- `percentage_revenue`: decimal rate in storage, entered as a human percentage in the UI.

A Per Customer expense must explicitly store one of:

- `new_customers`;
- `total_paying_customers`.

Task 8 must not infer this basis later.

All expense values/rates are non-negative. Percentage rates may exceed 100%; Task 8 only stores the input.

## Historical snapshots

Revenue streams and expense items can be renamed/reclassified after a month is saved. Historical monthly data must not silently change meaning because current setup metadata changed.

Therefore monthly child records snapshot:

- revenue stream name and Front-End/Backend classification;
- expense name, category, and cost behavior.

Editing an existing monthly row preserves its original snapshots. A new monthly row snapshots the current setup metadata.

## Active/inactive setup items

- Active revenue/expense items may be introduced into a new month.
- Inactive items are not introduced into a new month.
- An inactive item that already exists in a historical month remains visible/editable for that month.

## Previous-month copy

Task 8 may copy recurring expense inputs from the immediately previous calendar month.

Copy rules:

- revenue, refunds, and customer counts are never copied;
- only active current expense items are eligible;
- only non-null previous expense inputs are eligible;
- the previous behavior snapshot must still match the current expense behavior;
- existing non-null target-month expense values are never overwritten;
- a target row with no value may be filled;
- copied rows snapshot the current name/category/behavior.

This protects users from copying a fixed amount into an item that has since changed to a percentage or per-customer behavior.

## Atomic writes

Saving one month is transactional at the database level. The browser does not perform a sequence of independent table writes that could leave a partially saved financial month.

Authenticated users receive read access to monthly tables through RLS. Monthly mutation is exposed only through controlled database functions that re-check the established Admin-or-business-owner management boundary.

## Authorization

- Admin: may read/manage monthly data for every business.
- Business owner: may read/manage monthly data for their own business.
- Business member: read-only.
- Other Mentees: no access.

Manipulating `business_id`, stream IDs, expense IDs, month values, or calling the RPC directly must not cross the business boundary.

## UX

Route:

`/businesses/[businessId]/monthly?month=YYYY-MM`

The page must:

- render Arabic RTL;
- select/open a calendar month;
- navigate quickly to previous/next months;
- save and later edit a month;
- show the seven agreed sections without dashboard complexity;
- show Front-End/Backend context for stream inputs;
- show expense behavior and correct input unit;
- require an explicit basis for Per Customer expenses;
- support copying previous-month expense inputs;
- show read-only data to business members without mutation controls;
- preserve inactive historical rows;
- remain usable at 390px width;
- expose no calculated financial KPI in Task 8.

## Verification

Task 8 is complete only when:

1. monthly storage preserves zero vs missing;
2. monetary/count/rate validation follows the calculation specification;
3. `new_customers <= total_paying_customers` is enforced in PostgreSQL and the write function;
4. Per Customer basis is explicit and constrained;
5. revenue/expense historical snapshots survive later setup reclassification;
6. previous-month copy obeys all copy rules and does not overwrite target values;
7. writes are atomic and business-scoped;
8. members are read-only and cross-tenant RPC/table attacks fail;
9. Admin can manage any business;
10. the Arabic RTL save/edit/copy flow works across at least three months;
11. desktop/mobile browser checks show no horizontal overflow or console errors;
12. existing Tasks 1–7 tests remain green;
13. CodeRabbit has zero unresolved actionable comments before merge.
