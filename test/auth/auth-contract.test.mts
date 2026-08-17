import test from "node:test";
import assert from "node:assert/strict";
import { getRoleFromAppMetadata, getRoleFromClaims } from "../../src/lib/auth/role.ts";
import { safeLocalPath } from "../../src/lib/auth/redirect.ts";

test("role parser accepts only approved app_metadata roles", () => {
  assert.equal(getRoleFromAppMetadata({ role: "admin" }), "admin");
  assert.equal(getRoleFromAppMetadata({ role: "mentee" }), "mentee");
  assert.equal(getRoleFromAppMetadata({ role: "owner" }), null);
  assert.equal(getRoleFromAppMetadata(null), null);
});

test("claims role comes from app_metadata and ignores user_metadata", () => {
  assert.equal(
    getRoleFromClaims({ app_metadata: { role: "mentee" }, user_metadata: { role: "admin" } }),
    "mentee",
  );
  assert.equal(getRoleFromClaims({ user_metadata: { role: "admin" } }), null);
});

test("safeLocalPath preserves local routes and rejects external redirect forms", () => {
  assert.equal(safeLocalPath("/monthly?period=current"), "/monthly?period=current");
  assert.equal(safeLocalPath("https://evil.example"), "/");
  assert.equal(safeLocalPath("//evil.example/path"), "/");
  assert.equal(safeLocalPath("/\\evil.example"), "/");
  assert.equal(safeLocalPath(null, "/login"), "/login");
});
