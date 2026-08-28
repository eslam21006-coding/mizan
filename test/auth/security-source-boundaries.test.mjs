import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import test from "node:test";
import ts from "typescript";

const sourceRoot = new URL("../../src/", import.meta.url);
const serverClientUrl = new URL("../../src/lib/supabase/server.ts", import.meta.url);
const adminClientUrl = new URL("../../src/lib/supabase/admin.ts", import.meta.url);
const serverConfigUrl = new URL("../../src/lib/supabase/server-config.ts", import.meta.url);
const configUrl = new URL("../../src/lib/supabase/config.ts", import.meta.url);
const proxyUrl = new URL("../../src/lib/supabase/proxy.ts", import.meta.url);
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"]);

/** Collects executable source modules under one source directory. */
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

/** Parses actual import declarations and directive prologues instead of trusting source text. */
function parseModuleBoundary(sourceFilePath, source) {
  const extension = extname(sourceFilePath);
  const scriptKind =
    extension === ".tsx"
      ? ts.ScriptKind.TSX
      : extension === ".jsx"
        ? ts.ScriptKind.JSX
        : extension === ".js" || extension === ".mjs"
          ? ts.ScriptKind.JS
          : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    sourceFilePath,
    source,
    ts.ScriptTarget.Latest,
    false,
    scriptKind,
  );

  const importsServerOnly = sourceFile.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "server-only",
  );

  let usesClientDirective = false;
  for (const statement of sourceFile.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
    if (statement.expression.text === "use client") usesClientDirective = true;
  }

  return { importsServerOnly, usesClientDirective };
}

test("module boundary parser ignores comments and recognizes semicolonless client directives", () => {
  assert.deepEqual(
    parseModuleBoundary("comment-only.ts", '// import "server-only";\nexport const value = 1;'),
    { importsServerOnly: false, usesClientDirective: false },
  );
  assert.deepEqual(
    parseModuleBoundary("client.tsx", '"use client"\nimport "server-only"\nexport const value = 1;'),
    { importsServerOnly: true, usesClientDirective: true },
  );
});

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

    const boundary = parseModuleBoundary(sourceFile, source);
    assert.equal(
      boundary.importsServerOnly,
      true,
      `Elevated Supabase credential reference is not guarded by a real server-only import in ${sourceFile}`,
    );
    assert.equal(
      boundary.usesClientDirective,
      false,
      `Elevated Supabase credential reference appears in a client module: ${sourceFile}`,
    );
  }
});

test("privileged Supabase client and secret config remain explicitly server-only", async () => {
  for (const moduleUrl of [adminClientUrl, serverConfigUrl]) {
    const source = await readFile(moduleUrl, "utf8");
    const boundary = parseModuleBoundary(moduleUrl.pathname, source);
    assert.equal(boundary.importsServerOnly, true);
    assert.equal(boundary.usesClientDirective, false);
  }

  const adminSource = await readFile(adminClientUrl, "utf8");
  assert.match(adminSource, /getSupabaseSecretKey/);
  assert.match(adminSource, /persistSession:\s*false/);
  assert.match(adminSource, /autoRefreshToken:\s*false/);
});

test("request-scoped server Supabase client remains server-only and uses public configuration", async () => {
  const source = await readFile(serverClientUrl, "utf8");
  const boundary = parseModuleBoundary(serverClientUrl.pathname, source);
  assert.equal(boundary.importsServerOnly, true);
  assert.equal(boundary.usesClientDirective, false);
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
