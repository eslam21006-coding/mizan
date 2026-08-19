import test from "node:test";
import assert from "node:assert/strict";
import { getRoleFromAppMetadata, getRoleFromClaims } from "../../src/lib/auth/role.ts";
import {
  safeLocalPath,
  shouldRedirectAuthenticatedPublicPath,
} from "../../src/lib/auth/redirect.ts";
import { parseAuthSessionFragment } from "../../src/lib/auth/session-fragment.ts";
import { parseMizanSiteUrl } from "../../src/lib/auth/site-url.ts";

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
  assert.equal(safeLocalPath("/\n/evil.example"), "/");
  assert.equal(safeLocalPath("/\r/evil.example"), "/");
  assert.equal(safeLocalPath("/\t/evil.example"), "/");
  assert.equal(safeLocalPath("/%0A/evil.example"), "/");
  assert.equal(safeLocalPath(null, "/login"), "/login");
});

test("authenticated valid-role users leave login but can view access denied", () => {
  assert.equal(shouldRedirectAuthenticatedPublicPath("/login"), true);
  assert.equal(shouldRedirectAuthenticatedPublicPath("/access-denied"), false);
  assert.equal(shouldRedirectAuthenticatedPublicPath("/auth/confirm"), false);
  assert.equal(shouldRedirectAuthenticatedPublicPath("/auth/callback"), false);
});

test("implicit Supabase auth fragments accept only invite and recovery sessions", () => {
  assert.deepEqual(
    parseAuthSessionFragment("#access_token=access-1&refresh_token=refresh-1&type=invite"),
    { accessToken: "access-1", refreshToken: "refresh-1", type: "invite" },
  );
  assert.deepEqual(
    parseAuthSessionFragment("access_token=access-2&refresh_token=refresh-2&type=recovery"),
    { accessToken: "access-2", refreshToken: "refresh-2", type: "recovery" },
  );
  assert.equal(parseAuthSessionFragment("#refresh_token=refresh-1&type=invite"), null);
  assert.equal(parseAuthSessionFragment("#access_token=access-1&type=invite"), null);
  assert.equal(
    parseAuthSessionFragment("#access_token=access-1&refresh_token=refresh-1&type=signup"),
    null,
  );
  assert.equal(parseAuthSessionFragment("#error=access_denied&error_code=otp_expired"), null);
});

test("Mizan site URL requires HTTPS except HTTP on loopback development hosts", () => {
  assert.equal(parseMizanSiteUrl("https://mizan.example").origin, "https://mizan.example");
  assert.equal(parseMizanSiteUrl("http://localhost:3000").origin, "http://localhost:3000");
  assert.equal(parseMizanSiteUrl("http://127.0.0.1:3000").origin, "http://127.0.0.1:3000");
  assert.throws(() => parseMizanSiteUrl("http://mizan.example"));
  assert.throws(() => parseMizanSiteUrl("ftp://localhost"));
});
