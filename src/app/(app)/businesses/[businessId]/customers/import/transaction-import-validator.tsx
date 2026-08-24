"use client";

import { useState, type CSSProperties } from "react";
import {
  TRANSACTION_FIELD_LABELS,
  type TransactionColumnMapping,
} from "@/lib/business/transaction-column-mapping";
import {
  type CandidateDuplicateResolution,
  isValidTransactionImportSource,
  normalizeTransactionImportSource,
  prepareTransactionImportRows,
  transactionImportChunks,
  type PreparedTransactionImportRow,
  type TransactionDuplicateInputRow,
  TransactionImportPreparationError,
} from "@/lib/business/transaction-import";
import {
  validateTransactionImportRows,
  type TransactionImportValidationResult,
  type TransactionValidationField,
  type TransactionValidationIssue,
  type TransactionValidationIssueCode,
} from "@/lib/business/transaction-import-validation";
import type { TransactionFilePreview } from "@/lib/business/transaction-preview";
import {
  readTransactionValidationSource,
  TRANSACTION_VALIDATION_SOURCE_LIMITS,
  TransactionValidationSourceError,
  type TransactionValidationSourceErrorCode,
} from "@/lib/business/transaction-validation-source";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import task20Styles from "./transaction-import-task20.module.css";
import styles from "./transaction-import.module.css";

type TransactionImportValidatorProps = {
  businessId: string;
  preview: TransactionFilePreview;
  fileBuffer: ArrayBuffer;
  mapping: TransactionColumnMapping;
  onImportBusyChange: (busy: boolean) => void;
};

type ImportResult = {
  insertedCount: number;
  duplicateCount: number;
  candidateCount: number;
};

type RpcCandidateCollision = {
  row_number: number;
  existing_count: number;
};

type RpcImportResult = {
  inserted_count: number;
  duplicate_count: number;
  candidate_count: number;
  candidate_collisions: RpcCandidateCollision[];
};

type PendingCandidate = {
  row: PreparedTransactionImportRow;
  existingCount: number;
  resolutionId: string;
};

type ProcessingOutcome = {
  result: ImportResult;
  pendingCandidates: PendingCandidate[];
  remainingRows: PreparedTransactionImportRow[];
};

class TransactionImportProcessError extends Error {
  readonly confirmed: ImportResult;

  constructor(confirmed: ImportResult) {
    super("Transaction import RPC failed.");
    this.name = "TransactionImportProcessError";
    this.confirmed = confirmed;
  }
}

const FIELD_LABELS = {
  customerEmail: "بريد العميل",
  transactionDate: "تاريخ المعاملة",
  amountCollected: "المبلغ المحصل",
  transactionId: "Transaction ID",
} as const satisfies Record<TransactionValidationField, string>;

const ISSUE_MESSAGES = {
  EMAIL_REQUIRED: "بريد العميل مطلوب.",
  EMAIL_INVALID: "صيغة بريد العميل غير صالحة أو أطول من الحد المسموح.",
  TRANSACTION_DATE_REQUIRED: "تاريخ المعاملة مطلوب.",
  TRANSACTION_DATE_INVALID: "استخدم تاريخ ISO صالحًا مثل 2026-08-23.",
  AMOUNT_REQUIRED: "المبلغ المحصل مطلوب.",
  AMOUNT_INVALID: "المبلغ يجب أن يكون رقمًا صالحًا بدون رمز عملة.",
  TRANSACTION_ID_TOO_LONG: "Transaction ID أطول من 512 حرفًا.",
} as const satisfies Record<TransactionValidationIssueCode, string>;

const SOURCE_ERROR_MESSAGES = {
  INVALID_MAPPING: "الـ Mapping غير صالح. راجع الأعمدة المطلوبة ثم أعد المحاولة.",
  SOURCE_BYTES_MISMATCH: "تعذر مطابقة الملف الحالي مع المعاينة. اختر الملف من جديد.",
  SOURCE_ENCODING_UNSUPPORTED: "ترميز ملف CSV غير مدعوم للتحقق.",
  SOURCE_CSV_MALFORMED: "ملف CSV غير صالح للتحقق.",
  SOURCE_XLSX_INVALID: "ملف XLSX غير صالح أو تعذر قراءة بياناته للتحقق.",
  SOURCE_XLSX_UNSUPPORTED: "ملف XLSX يستخدم بنية غير مدعومة للتحقق داخل المتصفح.",
  SOURCE_TOO_MANY_ROWS: `عدد الصفوف غير الفارغة أكبر من حد التحقق داخل المتصفح (${TRANSACTION_VALIDATION_SOURCE_LIMITS.maxRows.toLocaleString("en-US")}).`,
  UNSUPPORTED_FILE_TYPE: "يمكن التحقق من CSV أو XLSX فقط.",
} as const satisfies Record<TransactionValidationSourceErrorCode, string>;

const VALIDATION_THEME_ALIASES = {
  "--text-primary": "var(--text)",
  "--text-secondary": "var(--text-soft)",
  "--surface-primary": "var(--surface)",
  "--surface-secondary": "var(--surface-soft)",
  "--border-subtle": "var(--border)",
  "--accent-primary": "var(--brand)",
} as CSSProperties;

function issueValue(issue: TransactionValidationIssue) {
  const value = issue.rawValue.trim();
  return value ? value.slice(0, 96) : "—";
}

function mappedColumns(mapping: TransactionColumnMapping) {
  const required = [mapping.customerEmail, mapping.transactionDate, mapping.amountCollected];
  if (!required.every((column): column is number => column !== null)) return null;

  const transactionId = mapping.transactionId ?? null;
  return {
    columns: transactionId === null ? required : [...required, transactionId],
    hasTransactionId: transactionId !== null,
  };
}

function parseNonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function parseRpcResult(data: unknown): RpcImportResult | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  const insertedCount = parseNonNegativeInteger(record.inserted_count);
  const duplicateCount = parseNonNegativeInteger(record.duplicate_count);
  const candidateCount = parseNonNegativeInteger(record.candidate_count);
  if (insertedCount === null || duplicateCount === null || candidateCount === null) return null;
  if (!Array.isArray(record.candidate_collisions)) return null;

  const candidateCollisions: RpcCandidateCollision[] = [];
  for (const rawCandidate of record.candidate_collisions) {
    if (!rawCandidate || typeof rawCandidate !== "object" || Array.isArray(rawCandidate)) return null;
    const candidate = rawCandidate as Record<string, unknown>;
    const rowNumber = parseNonNegativeInteger(candidate.row_number);
    const existingCount = parseNonNegativeInteger(candidate.existing_count);
    if (rowNumber === null || rowNumber < 1 || existingCount === null || existingCount < 1) return null;
    candidateCollisions.push({ row_number: rowNumber, existing_count: existingCount });
  }

  if (candidateCollisions.length !== candidateCount) return null;
  return {
    inserted_count: insertedCount,
    duplicate_count: duplicateCount,
    candidate_count: candidateCount,
    candidate_collisions: candidateCollisions,
  };
}

function zeroImportResult(): ImportResult {
  return { insertedCount: 0, duplicateCount: 0, candidateCount: 0 };
}

export function TransactionImportValidator({
  businessId,
  preview,
  fileBuffer,
  mapping,
  onImportBusyChange,
}: TransactionImportValidatorProps) {
  const [skipFirstRow, setSkipFirstRow] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [result, setResult] = useState<TransactionImportValidationResult | null>(null);
  const [validatedRows, setValidatedRows] = useState<TransactionDuplicateInputRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingCandidates, setPendingCandidates] = useState<PendingCandidate[]>([]);
  const [candidateDecisions, setCandidateDecisions] = useState<
    Record<number, CandidateDuplicateResolution | undefined>
  >({});
  const [remainingRows, setRemainingRows] = useState<PreparedTransactionImportRow[]>([]);

  const hasPendingCandidates = pendingCandidates.length > 0;
  const workflowLocked = isImporting || hasPendingCandidates;

  const validate = async () => {
    const selected = mappedColumns(mapping);
    if (!selected) {
      setResult(null);
      setValidatedRows(null);
      setError("أكمل Mapping الحقول المطلوبة أولًا.");
      return;
    }

    setIsValidating(true);
    setResult(null);
    setValidatedRows(null);
    setError(null);
    setImportResult(null);
    setImportError(null);
    setPendingCandidates([]);
    setCandidateDecisions({});
    setRemainingRows([]);
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const sourceRows = await readTransactionValidationSource({
        fileName: preview.fileName,
        fileSize: preview.fileSize,
        buffer: fileBuffer,
        columns: selected.columns,
      });
      const rows = sourceRows.rows.map((row) => ({
        rowNumber: row.rowNumber,
        customerEmail: row.values[0] ?? "",
        transactionDate: row.values[1] ?? "",
        amountCollected: row.values[2] ?? "",
        transactionId: selected.hasTransactionId ? (row.values[3] ?? "") : undefined,
      }));
      const validationResult = validateTransactionImportRows(rows, { skipFirstRow });
      setResult(validationResult);
      setValidatedRows(validationResult.isValid ? rows : null);
    } catch (caught) {
      if (caught instanceof TransactionValidationSourceError) {
        setError(SOURCE_ERROR_MESSAGES[caught.code]);
      } else {
        setError("حدث خطأ غير متوقع أثناء التحقق. لم يتم رفع أو حفظ أي بيانات.");
      }
    } finally {
      setIsValidating(false);
    }
  };

  const processRows = async (
    rows: PreparedTransactionImportRow[],
    baseResult: ImportResult,
  ): Promise<ProcessingOutcome> => {
    const supabase = createSupabaseBrowserClient();
    const chunks = transactionImportChunks(rows);
    let confirmed: ImportResult = { ...baseResult, candidateCount: 0 };

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
      const chunk = chunks[chunkIndex] ?? [];
      const { data, error: rpcError } = await supabase.rpc("import_customer_transactions", {
        p_business_id: businessId,
        p_source: normalizeTransactionImportSource(source),
        p_rows: chunk,
      });
      if (rpcError) throw new TransactionImportProcessError(confirmed);

      const parsed = parseRpcResult(data);
      if (!parsed) throw new TransactionImportProcessError(confirmed);

      confirmed = {
        insertedCount: confirmed.insertedCount + parsed.inserted_count,
        duplicateCount: confirmed.duplicateCount + parsed.duplicate_count,
        candidateCount: parsed.candidate_count,
      };

      if (parsed.candidate_count > 0) {
        const rowsByNumber = new Map(chunk.map((row) => [row.row_number, row]));
        const candidates = parsed.candidate_collisions.map((candidate) => {
          const row = rowsByNumber.get(candidate.row_number);
          if (!row || row.transaction_id !== null) {
            throw new TransactionImportProcessError({ ...confirmed, candidateCount: 0 });
          }
          return {
            row,
            existingCount: candidate.existing_count,
            resolutionId: crypto.randomUUID(),
          } satisfies PendingCandidate;
        });

        return {
          result: confirmed,
          pendingCandidates: candidates,
          remainingRows: chunks.slice(chunkIndex + 1).flat(),
        };
      }
    }

    return {
      result: { ...confirmed, candidateCount: 0 },
      pendingCandidates: [],
      remainingRows: [],
    };
  };

  const applyOutcome = (outcome: ProcessingOutcome) => {
    setImportResult(outcome.result);
    setPendingCandidates(outcome.pendingCandidates);
    setCandidateDecisions({});
    setRemainingRows(outcome.remainingRows);
    if (outcome.pendingCandidates.length === 0) onImportBusyChange(false);
  };

  const importTransactions = async () => {
    if (!result?.isValid || !validatedRows) {
      setImportError("شغّل Validation ناجحًا قبل الاستيراد.");
      return;
    }
    if (!isValidTransactionImportSource(source)) {
      setImportError("اكتب مصدرًا واضحًا للمعاملات من 1 إلى 80 حرفًا، مثل Stripe أو PayPal.");
      return;
    }

    let prepared: PreparedTransactionImportRow[];
    try {
      prepared = prepareTransactionImportRows(validatedRows, { skipFirstRow });
    } catch (caught) {
      if (caught instanceof TransactionImportPreparationError) {
        setImportError(`تعذر تجهيز الصف ${caught.rowNumber} للاستيراد. أعد Validation بعد مراجعة الملف.`);
      } else {
        setImportError("تعذر تجهيز الصفوف للاستيراد. لم يتم إرسال أي بيانات.");
      }
      return;
    }

    if (prepared.length === 0) {
      setImportError("لا توجد معاملات صالحة للاستيراد.");
      return;
    }

    setIsImporting(true);
    onImportBusyChange(true);
    setImportResult(null);
    setImportError(null);
    setPendingCandidates([]);
    setCandidateDecisions({});
    setRemainingRows([]);

    try {
      const outcome = await processRows(prepared, zeroImportResult());
      applyOutcome(outcome);
    } catch (caught) {
      const confirmed =
        caught instanceof TransactionImportProcessError ? caught.confirmed : zeroImportResult();
      if (confirmed.insertedCount + confirmed.duplicateCount > 0) setImportResult(confirmed);
      setImportError(
        confirmed.insertedCount + confirmed.duplicateCount > 0
          ? `توقف الاستيراد بعد تأكيد معالجة ${confirmed.insertedCount + confirmed.duplicateCount} صف. تمت إضافة ${confirmed.insertedCount} وتأكيد ${confirmed.duplicateCount} مكرر. يمكنك إعادة المحاولة بأمان.`
          : "تعذر استيراد المعاملات. لم يؤكد السيرفر حفظ أي صفوف. أعد المحاولة بعد التحقق من الاتصال.",
      );
      onImportBusyChange(false);
    } finally {
      setIsImporting(false);
    }
  };

  const resolveCandidates = async () => {
    if (pendingCandidates.length === 0 || !importResult) return;
    const allResolved = pendingCandidates.every(
      (candidate) => candidateDecisions[candidate.row.row_number] !== undefined,
    );
    if (!allResolved) {
      setImportError("اختر قرارًا لكل صف متصادم قبل المتابعة.");
      return;
    }

    const resolvedRows = pendingCandidates.map((candidate) => ({
      ...candidate.row,
      candidate_resolution: candidateDecisions[candidate.row.row_number] as CandidateDuplicateResolution,
      candidate_resolution_id: candidate.resolutionId,
    }));

    setIsImporting(true);
    setImportError(null);
    try {
      const resolutionOutcome = await processRows(resolvedRows, {
        ...importResult,
        candidateCount: 0,
      });
      if (resolutionOutcome.pendingCandidates.length > 0) {
        throw new TransactionImportProcessError(resolutionOutcome.result);
      }

      if (remainingRows.length === 0) {
        applyOutcome(resolutionOutcome);
        return;
      }

      const continuation = await processRows(remainingRows, resolutionOutcome.result);
      applyOutcome(continuation);
    } catch {
      setImportError(
        "تعذر تطبيق قرارات التصادم أو متابعة الاستيراد. أعد المحاولة؛ معرفات القرار تمنع تكرار قرار تم حفظه بالفعل.",
      );
    } finally {
      setIsImporting(false);
    }
  };

  const changeHeaderMode = (checked: boolean) => {
    setSkipFirstRow(checked);
    setResult(null);
    setValidatedRows(null);
    setError(null);
    setImportResult(null);
    setImportError(null);
    setPendingCandidates([]);
    setCandidateDecisions({});
    setRemainingRows([]);
  };

  return (
    <section
      className={styles.validationPanel}
      style={VALIDATION_THEME_ALIASES}
      aria-labelledby="transaction-validation-title"
    >
      <div className={styles.validationHeading}>
        <div>
          <span className={styles.kicker}>Task 20 · Validation + Duplicate Protection</span>
          <h2 id="transaction-validation-title">تحقق من الصفوف ثم استوردها بدون تكرار صامت</h2>
          <p>
            Validation يفحص الملف كاملًا أولًا. Transaction ID يعطي Duplicate مؤكدة؛ أما التطابق بدون ID فيتوقف
            حتى تختار بنفسك هل الصف مكرر أم شراء مستقل.
          </p>
        </div>
        {result && (
          <span className={result.isValid ? styles.validationReady : styles.validationBlocked}>
            {result.isValid ? "Validation ناجح" : "Validation يحتاج تعديل"}
          </span>
        )}
      </div>

      <div className={styles.validationControls}>
        <label className={styles.headerOption}>
          <input
            type="checkbox"
            checked={skipFirstRow}
            disabled={isValidating || workflowLocked}
            onChange={(event) => changeHeaderMode(event.currentTarget.checked)}
          />
          <span>
            <strong>أول صف غير فارغ يحتوي على عناوين الأعمدة</strong>
            <small>فعّل هذا الاختيار فقط إذا كان أول صف Header وليس معاملة فعلية.</small>
          </span>
        </label>
        <button
          type="button"
          className={styles.validationButton}
          disabled={isValidating || workflowLocked}
          onClick={() => void validate()}
        >
          {isValidating ? "جاري التحقق…" : "تشغيل Validation"}
        </button>
      </div>

      <div className={styles.validationMappingNote}>
        <span>{TRANSACTION_FIELD_LABELS.customerEmail}</span>
        <span>{TRANSACTION_FIELD_LABELS.transactionDate}</span>
        <span>{TRANSACTION_FIELD_LABELS.amountCollected}</span>
        <span>
          {TRANSACTION_FIELD_LABELS.transactionId}: {mapping.transactionId == null ? "Candidate check" : "Mapped"}
        </span>
      </div>

      {error && (
        <div className={styles.mappingError} role="alert">
          {error}
        </div>
      )}

      {result && (
        <>
          <div
            className={styles.validationSummary}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <div>
              <span>صفوف تم فحصها</span>
              <strong>{result.checkedRows}</strong>
            </div>
            <div>
              <span>صفوف صالحة</span>
              <strong>{result.validRows}</strong>
            </div>
            <div>
              <span>صفوف غير صالحة</span>
              <strong>{result.invalidRows}</strong>
            </div>
            <div>
              <span>مشكلات مكتشفة</span>
              <strong>{result.issueCount}</strong>
            </div>
          </div>

          {result.skippedHeaderRows > 0 && (
            <p className={styles.validationNote}>تم استبعاد أول صف غير فارغ باعتباره Header بناءً على اختيارك.</p>
          )}

          {result.isValid ? (
            <>
              <div className={styles.validationSuccess}>
                كل الصفوف صالحة. يمكنك الآن تحديد مصدر المعاملات وبدء الاستيراد مع Duplicate Protection.
              </div>
              <fieldset className={task20Styles.importPanel}>
                <legend className={task20Styles.importLegend}>Duplicate Protection قبل الحفظ</legend>
                <p>
                  إذا كان Transaction ID موجودًا نستخدمه كدليل Duplicate نهائي داخل نفس المصدر. عند غيابه،
                  التطابق في البريد + التاريخ + المبلغ + المصدر يعتبر Candidate فقط ولا يتم حذفه أو إضافته حتى
                  تحسمه أنت.
                </p>
                <div className={task20Styles.sourceField}>
                  <label htmlFor="transaction-import-source">مصدر المعاملات</label>
                  <input
                    id="transaction-import-source"
                    className={task20Styles.sourceInput}
                    value={source}
                    disabled={workflowLocked}
                    placeholder="مثال: Stripe"
                    autoComplete="off"
                    onChange={(event) => {
                      setSource(event.currentTarget.value);
                      setImportResult(null);
                      setImportError(null);
                    }}
                  />
                  <small>من 1 إلى 80 حرفًا Unicode. استخدم نفس الاسم دائمًا لنفس بوابة الدفع.</small>
                </div>
                <button
                  type="button"
                  className={task20Styles.importButton}
                  disabled={workflowLocked}
                  onClick={() => void importTransactions()}
                >
                  {isImporting ? "جاري الاستيراد…" : "استيراد المعاملات"}
                </button>

                {importResult && (
                  <div role="status" aria-live="polite" className={task20Styles.importSuccess}>
                    <div className={task20Styles.importSummary}>
                      <div>
                        <span>تمت إضافتها</span>
                        <strong>{importResult.insertedCount}</strong>
                      </div>
                      <div>
                        <span>مكررة مؤكدة</span>
                        <strong>{importResult.duplicateCount}</strong>
                      </div>
                      <div>
                        <span>تحتاج قرارًا</span>
                        <strong>{importResult.candidateCount}</strong>
                      </div>
                    </div>
                    {importResult.candidateCount > 0
                      ? " تم إيقاف الاستيراد عند أول مجموعة تصادمات حتى لا نفقد شراءً حقيقيًا أو نضاعف صفًا بصمت."
                      : importResult.insertedCount === 0 && importResult.duplicateCount > 0
                        ? " لم تتم مضاعفة أي معاملات؛ كل الصفوف كانت مكررة مؤكدة أو تم تأكيدها كمكررة."
                        : " تم حفظ الصفوف الجديدة فقط مع تطبيق قرارات التصادم بشكل قابل للتدقيق."}
                  </div>
                )}

                {pendingCandidates.length > 0 && (
                  <div className={task20Styles.candidatePanel}>
                    <div>
                      <h3>تصادمات تحتاج قرارك</h3>
                      <p>
                        هذه الصفوف تشبه معاملات موجودة لكنها ليست Duplicate مؤكدة. اختر لكل صف: مكرر فعلًا أو
                        احتفظ به كمعاملة مستقلة. يتم حفظ القرار في سجل تدقيق.
                      </p>
                    </div>
                    <div className={task20Styles.candidateTableShell}>
                      <table className={task20Styles.candidateTable} aria-label="تصادمات منع تكرار المعاملات">
                        <thead>
                          <tr>
                            <th scope="col">الصف</th>
                            <th scope="col">البريد</th>
                            <th scope="col">التاريخ</th>
                            <th scope="col">المبلغ</th>
                            <th scope="col">مطابقات موجودة</th>
                            <th scope="col">القرار</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingCandidates.map((candidate) => {
                            const rowNumber = candidate.row.row_number;
                            return (
                              <tr key={`${rowNumber}:${candidate.resolutionId}`}>
                                <td>{rowNumber}</td>
                                <td dir="auto">{candidate.row.customer_email}</td>
                                <td dir="ltr">{candidate.row.transaction_date}</td>
                                <td dir="ltr">{candidate.row.amount_collected}</td>
                                <td>{candidate.existingCount}</td>
                                <td>
                                  <select
                                    aria-label={`قرار التصادم للصف ${rowNumber}`}
                                    value={candidateDecisions[rowNumber] ?? ""}
                                    disabled={isImporting}
                                    onChange={(event) => {
                                      const value = event.currentTarget.value as CandidateDuplicateResolution | "";
                                      setCandidateDecisions((current) => ({
                                        ...current,
                                        [rowNumber]: value || undefined,
                                      }));
                                      setImportError(null);
                                    }}
                                  >
                                    <option value="">اختر</option>
                                    <option value="duplicate">مكرر — لا تضفه</option>
                                    <option value="keep_distinct">شراء مستقل — احتفظ به</option>
                                  </select>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <button
                      type="button"
                      className={task20Styles.importButton}
                      disabled={
                        isImporting ||
                        pendingCandidates.some(
                          (candidate) => candidateDecisions[candidate.row.row_number] === undefined,
                        )
                      }
                      onClick={() => void resolveCandidates()}
                    >
                      {isImporting ? "جاري تطبيق القرارات…" : "تطبيق القرارات والمتابعة"}
                    </button>
                  </div>
                )}

                {importError && (
                  <div role="alert" className={task20Styles.importError}>
                    {importError}
                  </div>
                )}
              </fieldset>
            </>
          ) : result.checkedRows === 0 ? (
            <div className={styles.mappingError} role="alert">
              {skipFirstRow
                ? "لا توجد معاملات قابلة للتحقق بعد استبعاد أول صف باعتباره Header."
                : "لا توجد صفوف معاملات قابلة للتحقق في الملف."}
            </div>
          ) : (
            <div className={styles.validationIssues}>
              <h3>أول المشكلات المكتشفة</h3>
              <div className={styles.tableShell}>
                <table className={styles.issueTable} aria-label="جدول أخطاء التحقق من المعاملات">
                  <thead>
                    <tr>
                      <th scope="col">الصف</th>
                      <th scope="col">الحقل</th>
                      <th scope="col">المشكلة</th>
                      <th scope="col">القيمة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.issues.map((issue) => (
                      <tr key={`${issue.rowNumber}:${issue.field}:${issue.code}`}>
                        <td>{issue.rowNumber}</td>
                        <td>{FIELD_LABELS[issue.field]}</td>
                        <td>{ISSUE_MESSAGES[issue.code]}</td>
                        <td dir="auto">{issueValue(issue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.issuesTruncated && (
                <p className={styles.validationNote}>
                  تم عرض عينة من المشكلات فقط. إجمالي المشكلات المكتشفة: {result.issueCount}.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
