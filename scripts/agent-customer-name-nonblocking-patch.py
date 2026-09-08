from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing marker in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


validator = "src/app/(app)/businesses/[businessId]/customers/import/transaction-import-validator.tsx"
replace_once(
    validator,
    '  const [importError, setImportError] = useState<string | null>(null);\n',
    '  const [importError, setImportError] = useState<string | null>(null);\n  const [nameImportWarning, setNameImportWarning] = useState<string | null>(null);\n',
)
replace_once(
    validator,
    '    setImportError(null);\n    setPendingCandidates([]);\n',
    '    setImportError(null);\n    setNameImportWarning(null);\n    setPendingCandidates([]);\n',
)
replace_once(
    validator,
    '''      const parsed = parseRpcResult(data);
      if (!parsed) throw new TransactionImportProcessError(confirmed);

      const { error: nameError } = await supabase.rpc("apply_customer_transaction_names", {
        p_business_id: businessId,
        p_source: source,
        p_rows: chunk,
      });
      if (nameError) throw new TransactionImportProcessError(confirmed);

      confirmed = {
        insertedCount: confirmed.insertedCount + parsed.inserted_count,
        duplicateCount: confirmed.duplicateCount + parsed.duplicate_count,
        candidateCount: parsed.candidate_count,
      };
''',
    '''      const parsed = parseRpcResult(data);
      if (!parsed) throw new TransactionImportProcessError(confirmed);

      // Financial persistence is authoritative. Optional customer-name metadata must never block
      // the import after the core transaction RPC has committed successfully.
      confirmed = {
        insertedCount: confirmed.insertedCount + parsed.inserted_count,
        duplicateCount: confirmed.duplicateCount + parsed.duplicate_count,
        candidateCount: parsed.candidate_count,
      };

      if (chunk.some((row) => row.customer_name)) {
        const { error: nameError } = await supabase.rpc("apply_customer_transaction_names", {
          p_business_id: businessId,
          p_source: source,
          p_rows: chunk,
        });
        if (nameError) {
          setNameImportWarning(
            "تم حفظ المعاملات المالية، لكن تعذر حفظ بعض أسماء العملاء الاختيارية. لن تتأثر أرقام العملاء أو التحصيل، ويمكن إعادة استيراد الملف لاحقًا لمحاولة إضافة الأسماء بدون تكرار المعاملات.",
          );
        }
      }
''',
)
replace_once(
    validator,
    '''                {completionSummary && importResult ? (
                  <TransactionImportCompletionCard
''',
    '''                {nameImportWarning && (
                  <div className={task20Styles.importError} role="status">
                    {nameImportWarning}
                  </div>
                )}

                {completionSummary && importResult ? (
                  <TransactionImportCompletionCard
''',
)

metadata_test = "test/business/customer-name-metadata.test.mts"
p = Path(metadata_test)
text = p.read_text()
if 'node:fs/promises' not in text:
    text = text.replace(
        'import assert from "node:assert/strict";\n',
        'import assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\n',
        1,
    )
text += '''\n
test("optional customer-name persistence cannot block a committed financial import", async () => {
  const source = await readFile(
    "src/app/(app)/businesses/[businessId]/customers/import/transaction-import-validator.tsx",
    "utf8",
  );
  const confirmedBeforeMetadata = source.indexOf("confirmed = {");
  const metadataRpc = source.indexOf('supabase.rpc("apply_customer_transaction_names"');
  assert.ok(confirmedBeforeMetadata >= 0 && metadataRpc > confirmedBeforeMetadata);
  assert.match(source, /if \(chunk\.some\(\(row\) => row\.customer_name\)\)/);
  assert.match(source, /if \(nameError\) \{[\s\S]*?setNameImportWarning/);
  assert.doesNotMatch(source, /if \(nameError\) throw new TransactionImportProcessError/);
});
'''
p.write_text(text)

Path(".github/workflows/agent-customer-name-nonblocking-patch.yml").unlink()
Path("scripts/agent-customer-name-nonblocking-patch.py").unlink()
