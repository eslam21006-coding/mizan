import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import test from "node:test";

const sourceRoot = new URL("../../src/", import.meta.url);
const serverClientUrl = new URL("../../src/lib/supabase/server.ts", import.meta.url);
const adminClientUrl = new URL("../../src/lib/supabase/admin.ts", import.meta.url);
const serverConfigUrl = new URL("../../src/lib/supabase/server-config.ts", import.meta.url);
const configUrl = new URL("../../src/lib/supabase/config.ts", import.meta.url);
const proxyUrl = new URL("../../src/lib/supabase/proxy.ts", import.meta.url);
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"]);
const serverOnlyImportPattern = /import\s+["']server-only["'];/;

async function collectSourceFiles(directoryUrl) {
  const directoryPath = directoryUrl.pathname;
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(new URL(`${entry.name}/`, directoryUrl))));
      continue;
    }
    if (entry.isFile() && sourceExtensions.has(extname(entry.name))) files.push(entryPath);
  }

  return files;
}

test("elevated Supabase credential references are confined to server-only modules", async () => {
  const sourceFiles = await collectSourceFiles(sourceRoot);
  const elevatedCredentialPatterns = [
    /SUPABASE_SERVICE_ROLE_KEY/,
    /SUPABASE_SECRET_KEY/,
    /NEXT_PUBLIC_[A-Z0-9_]*(?:SERVICE_ROLE|SECRET_KEY)/,
  ];

  for (const sourceFile of sourceFiles) {
    const source = await readFile(sourceFile, "utf8");
    if (!elevatedCredentialPatterns.some((pattern) => pattern.test(source))) continue;

    assert.match(
      source,
      serverOnlyImportPattern,
      `Elevated Supabase credential reference is not guarded by server-only in ${sourceFile}`,
    );
    assert.doesNotMatch(
      source,
      /^[\s\S]*?["']use client["'];/m,
      `Elevated Supabase credential reference appears in a client module: ${sourceFile}`,
    );
  }
});

test("privileged Supabase client and secret config remain explicitly server-only", async () => {
  for (const moduleUrl of [adminClientUrl, serverConfigUrl]) {
    const source = await readFile(moduleUrl, "utf8");
    assert.match(source, serverOnlyImportPattern);
    assert.doesNotMatch(source, /["']use client["'];/);
  }

  const adminSource = await readFile(adminClientUrl, "utf8");
  assert.match(adminSource, /getSupabaseSecretKey/);
  assert.match(adminSource, /persistSession:\s*false/);
  assert.match(adminSource, /autoRefreshToken:\s*false/);
});

test("request-scoped server Supabase client remains server-only and uses public configuration", async () => {
  const source = await readFile(serverClientUrl, "utf8");
  assert.match(source, serverOnlyImportPattern);
  assert.match(source, /getSupabasePublicConfig/);
  assert.doesNotMatch(source, /process\.env/);
  assert.doesNotMatch(source, /service[_-]?role/i);
  assert.doesNotMatch(source, /getSupabaseSecretKey/);
});

test("browser-safe Supabase runtime config exposes only the public URL and publishable key", async () => {
  const source = await readFile(configUrl, "utf8");
  const environmentVariables = [
    ...source.matchAll(/process\.env\.([A-Z0-9_]+)/g),
  ].map((match) => match[1]);

  assert.deepEqual(
    [...new Set(environmentVariables)].sort(),
    ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_URL"].sort(),
  );
  assert.doesNotMatch(source, /SUPABASE_(?:SERVICE_ROLE_KEY|SECRET_KEY)/);
});

test("server route gate verifies Supabase claims instead of trusting a local session payload", async () => {
  const source = await readFile(proxyUrl, "utf8");
  assert.match(source, /supabase\.auth\.getClaims\(\)/);
  assert.doesNotMatch(source, /supabase\.auth\.getSession\(\)/);
  assert.match(source, /getRoleFromClaims/);
});

test("no server or client source uses getSession as an authorization decision", async () => {
  const sourceFiles = await collectSourceFiles(sourceRoot);
  for (const sourceFile of sourceFiles) {
    const source = await readFile(sourceFile, "utf8");
    assert.doesNotMatch(source, /\.auth\.getSession\s*\(/, `Untrusted session authorization path in ${sourceFile}`);
  }
});
