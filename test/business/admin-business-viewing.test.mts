import assert from "node:assert/strict";
import test from "node:test";
import { resolveAdminViewingMentee } from "../../src/lib/admin-business-viewing.ts";
import type { MenteeDirectoryRow } from "../../src/lib/admin/mentee-directory.ts";

const MENTEE_ID = "00000000-0000-4000-8000-000000000057";
const ADMIN_ID = "00000000-0000-4000-8000-000000000058";
const OTHER_ADMIN_ID = "00000000-0000-4000-8000-000000000059";

const rows: MenteeDirectoryRow[] = [
  {
    mentee_user_id: MENTEE_ID,
    mentee_email: "mentee@example.test",
    mentee_created_at: "2026-08-01T00:00:00.000Z",
    business_id: "00000000-0000-4000-8000-000000000060",
    business_name: "Mentee Business",
    base_currency: "EGP",
    timezone: "Africa/Cairo",
  },
];

test("shows Admin context only when the owner is verified in the Mentee directory", () => {
  assert.equal(
    resolveAdminViewingMentee("admin", ADMIN_ID, MENTEE_ID, rows)?.userId,
    MENTEE_ID,
  );
  assert.equal(resolveAdminViewingMentee("admin", ADMIN_ID, ADMIN_ID, rows), null);
  assert.equal(resolveAdminViewingMentee("admin", ADMIN_ID, OTHER_ADMIN_ID, rows), null);
  assert.equal(resolveAdminViewingMentee("mentee", MENTEE_ID, MENTEE_ID, rows), null);
});
