import assert from "node:assert/strict";
import test from "node:test";
import {
  findMenteeRecord,
  groupMenteeDirectoryRows,
  type MenteeDirectoryRow,
} from "../../src/lib/admin/mentee-directory.ts";

const MENTEE_A = "00000000-0000-4000-8000-000000000571";
const MENTEE_B = "00000000-0000-4000-8000-000000000572";
const BUSINESS_A = "00000000-0000-4000-8000-000000000573";
const BUSINESS_B = "00000000-0000-4000-8000-000000000574";

const rows: MenteeDirectoryRow[] = [
  {
    mentee_user_id: MENTEE_A,
    mentee_email: "a@example.com",
    mentee_created_at: "2026-09-01T00:00:00Z",
    business_id: BUSINESS_A,
    business_name: "Business A",
    base_currency: "EGP",
    timezone: "Africa/Cairo",
  },
  {
    mentee_user_id: MENTEE_A,
    mentee_email: "a@example.com",
    mentee_created_at: "2026-09-01T00:00:00Z",
    business_id: BUSINESS_B,
    business_name: "Business B",
    base_currency: "USD",
    timezone: "Asia/Riyadh",
  },
  {
    mentee_user_id: MENTEE_A,
    mentee_email: "a@example.com",
    mentee_created_at: "2026-09-01T00:00:00Z",
    business_id: BUSINESS_A,
    business_name: "Business A",
    base_currency: "EGP",
    timezone: "Africa/Cairo",
  },
  {
    mentee_user_id: MENTEE_B,
    mentee_email: "b@example.com",
    mentee_created_at: null,
    business_id: null,
    business_name: null,
    base_currency: null,
    timezone: null,
  },
];

test("groups admin directory rows into Mentee parents with unique child businesses", () => {
  const result = groupMenteeDirectoryRows(rows);

  assert.equal(result.length, 2);
  assert.equal(result[0]?.userId, MENTEE_A);
  assert.deepEqual(
    result[0]?.businesses.map((business) => business.id),
    [BUSINESS_A, BUSINESS_B],
  );
  assert.equal(result[1]?.userId, MENTEE_B);
  assert.equal(result[1]?.businesses.length, 0);
});

test("fails closed for malformed Mentee IDs and finds only an exact validated parent", () => {
  const withMalformed = [
    ...rows,
    {
      ...rows[0],
      mentee_user_id: "not-a-user-id",
      business_id: "not-a-business-id",
    },
  ];

  assert.equal(groupMenteeDirectoryRows(withMalformed).length, 2);
  assert.equal(findMenteeRecord(rows, "not-a-user-id"), null);
  assert.equal(findMenteeRecord(rows, "00000000-0000-4000-8000-000000000599"), null);

  const mentee = findMenteeRecord(rows, MENTEE_A);
  assert.ok(mentee);
  assert.equal(mentee.email, "a@example.com");
  assert.equal(mentee.businesses.length, 2);
});
