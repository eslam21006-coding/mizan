import assert from "node:assert/strict";
import test from "node:test";
import { resolveAdminViewingMenteeUserId } from "../../src/lib/admin-business-viewing.ts";

test("shows Admin viewing context only for a business owned by another user", () => {
  assert.equal(
    resolveAdminViewingMenteeUserId("admin", "admin-user", "mentee-user"),
    "mentee-user",
  );
  assert.equal(resolveAdminViewingMenteeUserId("admin", "admin-user", "admin-user"), null);
  assert.equal(resolveAdminViewingMenteeUserId("mentee", "mentee-user", "mentee-user"), null);
  assert.equal(resolveAdminViewingMenteeUserId("mentee", "viewer-user", "other-user"), null);
});
