import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readMigration = (name: string) =>
  readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8");

const addColumn = await readMigration("20260818105500_task_5_business_creation_idempotency.sql");
const addPresenceCheck = await readMigration(
  "20260818105501_task_5_creation_request_presence_check.sql",
);
const backfill = await readMigration("20260818105502_task_5_backfill_creation_request_ids.sql");
const validatePresence = await readMigration(
  "20260818105503_task_5_validate_creation_request_presence.sql",
);
const setNotNull = await readMigration("20260818105504_task_5_set_creation_request_not_null.sql");
const createUniqueIndex = await readMigration(
  "20260818105505_task_5_creation_request_unique_index.sql",
);
const attachUniqueConstraint = await readMigration(
  "20260818105506_task_5_attach_creation_request_unique_constraint.sql",
);
const immutability = await readMigration(
  "20260818105507_task_5_creation_request_immutability.sql",
);

test("idempotency rollout requires explicit request IDs and avoids a volatile column default", () => {
  assert.match(addColumn, /add column creation_request_id uuid\s*;/i);
  assert.doesNotMatch(addColumn, /default/i);
});

test("existing businesses are backfilled before NOT NULL is enforced", () => {
  assert.match(addPresenceCheck, /check \(creation_request_id is not null\) not valid/i);
  assert.match(backfill, /set creation_request_id = gen_random_uuid\(\)/i);
  assert.match(backfill, /where creation_request_id is null/i);
  assert.match(validatePresence, /validate constraint businesses_creation_request_id_present/i);
  assert.match(setNotNull, /alter column creation_request_id set not null/i);
});

test("uniqueness is built concurrently before the table constraint is attached", () => {
  assert.match(
    createUniqueIndex,
    /create unique index concurrently businesses_owner_creation_request_unique/i,
  );
  assert.match(createUniqueIndex, /\(owner_user_id, creation_request_id\)/i);
  assert.match(
    attachUniqueConstraint,
    /unique using index businesses_owner_creation_request_unique/i,
  );
});

test("creation request IDs become immutable after rollout", () => {
  assert.match(immutability, /old\.creation_request_id is distinct from new\.creation_request_id/i);
  assert.match(immutability, /before update of creation_request_id on public\.businesses/i);
  assert.match(immutability, /errcode = '42501'/i);
});
