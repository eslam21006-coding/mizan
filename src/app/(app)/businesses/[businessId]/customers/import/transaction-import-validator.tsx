"use client";

import { useState } from "react";
import {
  TRANSACTION_FIELD_LABELS,
  type TransactionColumnMapping,
} from "@/lib/business/transaction-column-mapping";
import {
  validateTransactionImportRows,
  type TransactionImportValidationResult,
  type TransactionValidationIssue,
} from "@/lib/business/transaction-import-validation";
import type { TransactionFilePreview } from "@/lib/business/transaction-preview";
import {
  readTransactionValidationSource,
  TransactionValidationSourceError,
} from "@/lib/business/transaction-validation-source";
import styles from "./transaction-import.module.css";

type TransactionImportValidatorProps = {
  preview: TransactionFilePreview;
  fileBuffer: ArrayBuffer;
  mapping: TransactionColumnMapping;
};

const FIELD_LABELS = {
  customerEmail: "بريد العميل",
  transactionDate: "تاريخ المعاملة",
  amountCollected: "المبلغ المحصل",
} as const;

const ISSUE_MESSAGES = {
  EMAIL_REQUIRED: "بريد العميل مطلوب.",
  EMAIL_INVALID: "صيغة بريد العميل غير صالحة.",
  TRANSACTION_DATE_REQUIRED: "تاريخ المعاملة مطلوب.",
  TRANSACTION_DATE_INVALID: "استخدم تاريخ ISO صالحًا مثل 2026-08-23.",
  AMOUNT_REQUIRED: "المبلغ المحصل مطلوب.",
  AMOUNT_INVALID: "المبلغ يجب أن يكون رقمًا صالحًا بدون رمز عملة.",
} as const;

const SOURCE_ERROR_MESSAGES = {
  INVALID_MAPPING: "الـ Mapping غير صالح. راجع الأعمدة المطلوبة ثم أعد المحاولة.",
  SOURCE_BYTES_MISMATCH: "تعذر مطابقة الملف الحالي مع المعاينة. اختر الملف من جديد.",
  SOURCE_ENCODING_UNSUPPORTED: "ترميز ملف CSV غير مدعوم للتحقق.",
  SOURCE_CSV_MALFORMED: "ملف CSV غير صالح للتحقق.",
  SOURCE_XLSX_INVALID: "ملف XLSX غير صالح أو تعذر قراءة بياناته للتحقق.",
  SOURCE_XLSX_UNSUPPORTED: "ملف XLSX يستخدم بنية غير مدعومة للتحقق داخل المتصفح.",
  SOURCE_TOO_MANY_ROWS: "عدد الصفوف أكبر من حد التحقق الآمن داخل المتصفح.",
  UNSUPPORTED_FILE_TYPE: "يمكن التحقق من CSV أو XLSX فقط.",
} as const;

function issueValue(issue: TransactionValidationIssue) {
  const value = issue.rawValue.trim();
  return value ? value.slice(0, 96) : "—";
}

function mappingColumns(mapping: TransactionColumnMapping) {
  const columns = [mapping.customerEmail, mapping.transactionDate, mapping.amountCollected];
  return columns.every((column): column is number => column !== null) ? columns : null;
}

export function TransactionImportValidator({
  preview,
  fileBuffer,
  mapping,
}: TransactionImportValidatorProps) {
  const [skipFirstRow, setSkipFirstRow] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [result, setResult] = useState<TransactionImportValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validate = async () => {
    const columns = mappingColumns(mapping);
    if (!columns) {
      setResult(null);
      setError("أكمل Mapping الحقول المطلوبة أولًا.");
      return;
    }

    setIsValidating(true);
    setResult(null);
    setError(null);
    try {
      const source = await readTransactionValidationSource({
        fileName: preview.fileName,
        fileSize: preview.fileSize,
        buffer: fileBuffer,
        columns,
      });
      const rows = source.rows.map((row) => ({
        rowNumber: row.rowNumber,
        customerEmail: row.values[0] ?? "",
        transactionDate: row.values[1] ?? "",
        amountCollected: row.values[2] ?? "",
      }));
      setResult(validateTransactionImportRows(rows, { skipFirstRow }));
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

  const changeHeaderMode = (checked: boolean) => {
    setSkipFirstRow(checked);
    setResult(null);
    setError(null);
  };

  return (
    <section className={styles.validationPanel} aria-labelledby="transaction-validation-title">
      <div className={styles.validationHeading}>
        <div>
          <span className={styles.kicker}>Task 19 · Import Validation</span>
          <h2 id="transaction-validation-title">تحقق من الصفوف قبل الانتقال للـ Duplicate Protection</h2>
          <p>
            يتم فحص كل صف غير فارغ في الملف باستخدام الأعمدة الثلاثة التي ربطتها. لا يتم رفع الملف أو حفظ
            المعاملات، ولا يتم فحص التكرار في هذه الخطوة.
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
            disabled={isValidating}
            onChange={(event) => changeHeaderMode(event.currentTarget.checked)}
          />
          <span>
            <strong>أول صف غير فارغ يحتوي على عناوين الأعمدة</strong>
            <small>فعّل هذا الاختيار فقط إذا كان أول صف Header وليس معاملة فعلية.</small>
          </span>
        </label>
        <button type="button" className={styles.validationButton} disabled={isValidating} onClick={() => void validate()}>
          {isValidating ? "جاري التحقق…" : "تشغيل Validation"}
        </button>
      </div>

      <div className={styles.validationMappingNote}>
        <span>{TRANSACTION_FIELD_LABELS.customerEmail}</span>
        <span>{TRANSACTION_FIELD_LABELS.transactionDate}</span>
        <span>{TRANSACTION_FIELD_LABELS.amountCollected}</span>
      </div>

      {error && (
        <div className={styles.mappingError} role="alert">
          {error}
        </div>
      )}

      {result && (
        <>
          <div className={styles.validationSummary} aria-label="ملخص التحقق من ملف المعاملات">
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
            <div className={styles.validationSuccess} role="status">
              كل الصفوف التي تم فحصها صالحة للحقول المطلوبة. لم يتم بعد تنفيذ Duplicate Protection أو Import؛
              وهذه هي الخطوة التالية فقط.
            </div>
          ) : result.checkedRows === 0 ? (
            <div className={styles.mappingError} role="alert">
              لا توجد معاملات قابلة للتحقق بعد استبعاد الـ Header.
            </div>
          ) : (
            <div className={styles.validationIssues}>
              <h3>أول المشكلات المكتشفة</h3>
              <div className={styles.tableShell} tabIndex={0} role="group" aria-label="جدول أخطاء التحقق من المعاملات">
                <table className={styles.issueTable}>
                  <thead>
                    <tr>
                      <th scope="col">الصف</th>
                      <th scope="col">الحقل</th>
                      <th scope="col">المشكلة</th>
                      <th scope="col">القيمة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.issues.map((issue, index) => (
                      <tr key={`${issue.rowNumber}:${issue.field}:${issue.code}:${index}`}>
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
