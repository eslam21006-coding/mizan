import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import test from "node:test";

const sourceRoot = new URL("../../src/", import.meta.url);
const serverClientUrl = new URL("../../src/lib/supabase/server.ts", import.meta.url);
const configUrl = new URL("../../src/lib/supabase/config.ts", import.meta.url);
const proxyUrl = new URL("../../src/lib/supabase/proxy.ts", import.meta.url);
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"]);

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

test("application source never embeds or references a Supabase elevated secret", async () => {
  const sourceFiles = await collectSourceFiles(sourceRoot);
  const forbidden = [
    /SUPABASE_SERVICE_ROLE_KEY/,
    /SUPABASE_SECRET_KEY/,
    /NEXT_PUBLIC_[A-Z0-9_]*(?:SERVICE_ROLE|SECRET_KEY)/,
  ];

  for (const sourceFile of sourceFiles) {
    const source = await readFile(sourceFile, "utf8");
    for (const pattern of forbidden) {
      assert.doesNotMatch(source, pattern, `Forbidden elevated Supabase credential reference in ${sourceFile}`);
    }
  }
});

test("server Supabase client remains server-only and uses public configuration", async () => {
  const source = await readFile(serverClientUrl, "utf8");
  assert.match(source, /import\s+["']server-only["'];/);
  assert.match(source, /getSupabasePublicConfig/);
  assert.doesNotMatch(source, /process\.env/);
  assert.doesNotMatch(source, /service[_-]?role/i);
});

test("Supabase runtime config exposes only the approved public URL and publishable key", async () => {
  const source = await readFile(configUrl, "utf8");
  const environmentVariables = [
    ...source.matchAll(/process\.env\.([A-Z0-9_]+)/g),
  ].map((match) => match[1]);

  assert.deepEqual(
    [...new Set(environmentVariables)].sort(),
    ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_URL"].sort(),
  );
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
