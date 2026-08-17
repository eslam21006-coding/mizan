import test from "node:test";
import assert from "node:assert/strict";
import { findAuthUserByEmail } from "../../scripts/lib/find-auth-user.mjs";

test("Admin lookup scans later Auth pages before deciding to invite", async () => {
  const calls = [];
  const adminAuth = {
    async listUsers({ page, perPage }) {
      calls.push({ page, perPage });
      if (page === 1) {
        return {
          data: {
            users: Array.from({ length: 2 }, (_, index) => ({
              email: `user-${index}@example.test`,
            })),
          },
          error: null,
        };
      }

      return {
        data: { users: [{ id: "admin-id", email: "admin@example.test" }] },
        error: null,
      };
    },
  };

  const user = await findAuthUserByEmail(adminAuth, "admin@example.test", 2);

  assert.equal(user?.id, "admin-id");
  assert.deepEqual(calls, [
    { page: 1, perPage: 2 },
    { page: 2, perPage: 2 },
  ]);
});

test("Admin lookup normalizes mixed-case and surrounding whitespace", async () => {
  const adminAuth = {
    async listUsers() {
      return {
        data: { users: [{ id: "admin-id", email: " admin@example.test " }] },
        error: null,
      };
    },
  };

  const user = await findAuthUserByEmail(adminAuth, " Admin@Example.Test ");

  assert.equal(user?.id, "admin-id");
});

test("Admin lookup stops when the final page is shorter than the page size", async () => {
  let calls = 0;
  const adminAuth = {
    async listUsers() {
      calls += 1;
      return { data: { users: [{ email: "other@example.test" }] }, error: null };
    },
  };

  const user = await findAuthUserByEmail(adminAuth, "missing@example.test", 2);

  assert.equal(user, undefined);
  assert.equal(calls, 1);
});

test("Admin lookup propagates Supabase list errors", async () => {
  const expected = new Error("list failed");
  const adminAuth = {
    async listUsers() {
      return { data: { users: [] }, error: expected };
    },
  };

  await assert.rejects(() => findAuthUserByEmail(adminAuth, "admin@example.test"), expected);
});
