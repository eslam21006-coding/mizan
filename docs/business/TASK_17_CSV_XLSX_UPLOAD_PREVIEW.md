# Task 17 — CSV/XLSX Upload & Preview

## Scope

Task 17 activates the first step of transaction imports without importing anything yet.

A user selects a payment-gateway export for one business and Mizan shows a bounded raw preview of the file.

Supported file types:

- `.csv`
- `.xlsx`

## Privacy boundary

Preview parsing happens entirely in the browser.

Task 17 does **not**:

- upload the file to Mizan servers;
- write the file to Supabase Storage;
- create transaction rows;
- create customer rows;
- persist preview data;
- infer a payment-gateway schema.

This keeps customer PII out of server-side storage until the later import stages are implemented and verified.

## Preview behavior

Mizan displays:

- file name;
- file type;
- file size;
- detected CSV delimiter or first XLSX worksheet name;
- total parsed row count;
- total detected column count;
- the first 25 parsed rows;
- the first 20 detected columns.

The parser processes the selected file to determine row/column totals, but the table is bounded to protect browser rendering performance.

The preview does not assume that row 1 is a header and does not assign business meaning to any column.

## Browser safety limits

- Maximum selected file size: 25 MiB.
- Maximum declared uncompressed XLSX archive size: 100 MiB.
- Maximum XLSX ZIP entries: 20,000.
- Encrypted, multi-disk, ZIP64, or unsupported-compression XLSX archives are rejected.
- Invalid/corrupt CSV or XLSX files fail closed with no partial preview state.

## CSV behavior

- Auto-detects comma, semicolon, or tab delimiters.
- Supports quoted fields, escaped quotes, and embedded line breaks.
- Supports UTF-8, UTF-8 BOM, UTF-16LE BOM, and UTF-16BE BOM.
- Does not silently reinterpret undecodable text as another legacy encoding.

## XLSX behavior

The preview reader supports standard Open XML workbooks and reads the first worksheet only in Task 17.

It supports:

- stored or DEFLATE-compressed ZIP entries;
- shared strings;
- inline strings;
- booleans;
- cached formula values;
- common Excel date cell styles;
- sparse columns.

## Authorization

The `/customers` page lists businesses through existing business RLS.

For a business-scoped preview page:

- Admin can preview.
- Business owner can preview.
- Read-only business member can view the page but cannot select a transaction file through the Mizan UI.
- Unrelated Mentee cannot load the business page because the business query is RLS-filtered.

No new database table, RLS policy, RPC, or storage bucket is introduced in Task 17.

## Explicitly out of scope

### Task 18 — Column Mapping

Required Mizan fields are not mapped yet:

- Customer Email
- Transaction Date
- Amount Collected

Optional fields are not mapped yet either.

### Task 19 — Import Validation

Task 17 does not validate transaction semantics, currencies, statuses, refund types, required-field completeness, or row-level import readiness.

### Task 20 — Duplicate Protection

Task 17 does not deduplicate Transaction IDs or fallback keys and cannot write duplicate transactions because it does not persist any transactions at all.

### Later transaction analytics

Task 17 does not calculate acquisition cohorts, Observed LTV, or Lifetime Contribution Profit.

## Verification requirements

- CSV parser tests for delimiters, quoted fields, multiline fields, encodings, malformed files, and preview limits.
- Real ZIP-based XLSX parser test with DEFLATE compression, shared strings, worksheet metadata, and a date-formatted cell.
- TypeScript/static checks.
- Production build.
- Arabic RTL browser verification at desktop and 390px mobile width.
- Browser verification must confirm no page-level horizontal overflow; the preview table may scroll inside its own bounded container.
