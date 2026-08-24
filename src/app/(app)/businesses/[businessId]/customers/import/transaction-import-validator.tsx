"use client";

import { useState, type CSSProperties } from "react";
import {
  TRANSACTION_FIELD_LABELS,
  type TransactionColumnMapping,
} from "@/lib/business/transaction-column-mapping";
import {
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
};

type ImportResult = {
  insertedCount: number;
  duplicateCount: number;
};

const FIELD_LABELS = {
  customerEmail: "بريد العميل",
  transactionDate: "تاريخ المعاملة",
  amountCollected: "المبلغ المحصل",
} as const satisfies Record<TransactionValidationField, string>;

const ISSUE_MESSAGES = {
  EMAIL_REQUIRED: "بريد العميل مطلوب.",
  EMAIL_INVALID: "صيغة بريد العميل غير صالحة.",
  TRANSACTION_DATE_REQUIRED: "تاريخ المعاملة مطلوب.",
  TRANSACTION_DATE_INVALID: "استخدم تاريخ ISO صالحًا مثل 2026-08-23.",
  AMOUNT_REQUIRED: "المبلغ المحصل مطلوب.",
  AMOUNT_INVALID: "المبلغ يجب أن يكون رقمًا صالحًا بدون رمز عملة.",
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

function parseRpcResult(data: unknown): { inserted_count: number; duplicate_count: number } | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  if (
    typeof record.inserted_count !== "number" ||
    typeof record.duplicate_count !== "number" ||
    !Number.isSafeInteger(record.inserted_count) ||
    !Number.isSafeInteger(record.duplicate_count) ||
    record.inserted_count < 0 ||
    record.duplicate_count < 0
  ) {
    return null;
  }
  return {
    inserted_count: record.inserted_count,
    duplicate_count: record.duplicate_count,
  };
}

export function TransactionImportValidator({
  businessId,
  preview,
  fileBuffer,
  mapping,
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
    setImportResult(null);
    setImportError(null);
    const supabase = createSupabaseBrowserClient();
    let insertedCount = 0;
    let duplicateCount = 0;

    try {
      for (const chunk of transactionImportChunks(prepared)) {
        const { data, error: rpcError } = await supabase.rpc("import_customer_transactions", {
          p_business_id: businessId,
          p_source: normalizeTransactionImportSource(source),
          p_rows: chunk,
        });
        if (rpcError) throw rpcError;
        const parsed = parseRpcResult(data);
        if (!parsed) throw new Error("Unexpected transaction import response.");
        insertedCount += parsed.inserted_count;
        duplicateCount += parsed.duplicate_count;
      }

      setImportResult({ insertedCount, duplicateCount });
    } catch {
      setImportError(
        insertedCount + duplicateCount > 0
          ? `توقف الاستيراد بعد معالجة ${insertedCount + duplicateCount} صف. تمت إضافة ${insertedCount} وتخطي ${duplicateCount} مكرر. إعادة المحاولة آمنة لأن Duplicate Protection يعمل داخل قاعدة البيانات.`
          : "تعذر استيراد المعاملات. لم يؤكد السيرفر حفظ أي صفوف. أعد المحاولة بعد التحقق من الاتصال.",
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
          <h2 id="transaction-validation-title">تحقق من الصفوف ثم استوردها بدون تكرار</h2>
          <p>
            Validation يفحص الملف كاملًا أولًا. بعد نجاحه، الاستيراد يحفظ الصفوف الجديدة فقط ويعرض عدد الصفوف
            المكررة التي تم تخطيها بدلًا من مضاعفة الأرقام بصمت.
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
            disabled={isValidating || isImporting}
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
          disabled={isValidating || isImporting}
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
          {TRANSACTION_FIELD_LABELS.transactionId}: {mapping.transactionId == null ? "Fallback key" : "Mapped"}
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
                كل الصفوف صالحة. يمكنك الآن تحديد مصدر المعاملات وبدء الاستيراد الآمن من التكرار.
              </div>
              <fieldset className={task20Styles.importPanel}>
                <legend className={task20Styles.importLegend}>Duplicate Protection قبل الحفظ</legend>
                <p>
                  إذا كان Transaction ID مربوطًا نستخدمه كمفتاح أساسي داخل نفس المصدر. عند غيابه نستخدم
                  البريد الموحّد + التاريخ + المبلغ + المصدر. أي تكرار يتم تخطيه وإظهاره في النتيجة.
                </p>
                <div className={task20Styles.sourceField}>
                  <label htmlFor="transaction-import-source">مصدر المعاملات</label>
                  <input
                    id="transaction-import-source"
                    className={task20Styles.sourceInput}
                    value={source}
                    maxLength={80}
                    disabled={isImporting}
                    placeholder="مثال: Stripe"
                    autoComplete="off"
                    onChange={(event) => {
                      setSource(event.currentTarget.value);
                      setImportResult(null);
                      setImportError(null);
                    }}
                  />
                  <small>استخدم نفس اسم المصدر في كل تصدير من نفس بوابة الدفع حتى يعمل الـ fallback key بثبات.</small>
                </div>
                <button
                  type="button"
                  className={task20Styles.importButton}
                  disabled={isImporting}
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
                        <span>مكررة تم تخطيها</span>
                        <strong>{importResult.duplicateCount}</strong>
                      </div>
                    </div>
                    {importResult.insertedCount === 0 && importResult.duplicateCount > 0
                      ? " لم تتم مضاعفة أي معاملات؛ كل الصفوف كانت موجودة بالفعل."
                      : " تم حفظ الصفوف الجديدة فقط، ولم يتم احتساب الصفوف المكررة مرة أخرى."}
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
