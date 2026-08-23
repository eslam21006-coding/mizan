"use client";

import { useRef, useState } from "react";
import { transactionColumnLabel } from "@/lib/business/transaction-columns";
import {
  buildTransactionFilePreview,
  TRANSACTION_PREVIEW_LIMITS,
  TransactionPreviewError,
  type TransactionFilePreview,
} from "@/lib/business/transaction-preview";
import { TransactionColumnMapper } from "./transaction-column-mapper";
import styles from "./transaction-import.module.css";

type TransactionPreviewUploaderProps = {
  canManage: boolean;
};

const ERROR_MESSAGES: Record<string, string> = {
  EMPTY_FILE: "الملف فارغ أو تعذر قراءة محتواه.",
  FILE_TOO_LARGE: `حجم الملف أكبر من الحد المسموح للمعاينة (${Math.round(TRANSACTION_PREVIEW_LIMITS.maxFileBytes / 1024 / 1024)} MB).`,
  UNSUPPORTED_FILE_TYPE: "اختر ملف CSV أو XLSX فقط.",
  CSV_ENCODING_UNSUPPORTED: "ترميز ملف CSV غير مدعوم. استخدم UTF-8، أو UTF-16 مع BOM.",
  CSV_MALFORMED: "ملف CSV غير صالح أو يحتوي على علامات اقتباس غير مكتملة.",
  XLSX_INVALID_ARCHIVE: "ملف XLSX غير صالح أو تالف، لذلك لم تتم معاينته.",
  XLSX_UNSUPPORTED_ARCHIVE: "ملف XLSX يستخدم صيغة ضغط أو حماية غير مدعومة في المعاينة.",
  XLSX_TOO_LARGE: "محتوى ملف XLSX بعد فك الضغط أكبر من حد المعاينة الآمن.",
  XLSX_WORKBOOK_MISSING: "ملف XLSX لا يحتوي على بيانات Workbook صالحة.",
  XLSX_SHEET_MISSING: "لم يتم العثور على Worksheet قابلة للمعاينة داخل ملف XLSX.",
};

function fileSizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function delimiterLabel(delimiter: string | null) {
  if (delimiter === ",") return "فاصلة ,";
  if (delimiter === ";") return "فاصلة منقوطة ;";
  if (delimiter === "\t") return "Tab";
  return "—";
}

function keyedRows(rows: string[][]) {
  const occurrences = new Map<string, number>();
  return rows.map((row) => {
    const signature = JSON.stringify(row);
    const occurrence = (occurrences.get(signature) ?? 0) + 1;
    occurrences.set(signature, occurrence);
    return { key: `${signature}:${occurrence}`, row };
  });
}

function errorMessage(error: unknown) {
  if (error instanceof TransactionPreviewError) {
    return ERROR_MESSAGES[error.code] ?? "تعذر معاينة الملف. لم يتم حفظ أو رفع أي بيانات.";
  }
  return "حدث خطأ غير متوقع أثناء قراءة الملف. لم يتم حفظ أو رفع أي بيانات.";
}

export function TransactionPreviewUploader({ canManage }: TransactionPreviewUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<TransactionFilePreview | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);

  const reset = () => {
    if (inputRef.current) inputRef.current.value = "";
    setPreview(null);
    setFileBuffer(null);
    setError(null);
    setIsReading(false);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setPreview(null);
    setFileBuffer(null);
    setError(null);

    if (file.size > TRANSACTION_PREVIEW_LIMITS.maxFileBytes) {
      setError(ERROR_MESSAGES.FILE_TOO_LARGE);
      setIsReading(false);
      return;
    }

    setIsReading(true);
    try {
      const buffer = await file.arrayBuffer();
      const result = await buildTransactionFilePreview({
        fileName: file.name,
        fileSize: file.size,
        buffer,
      });
      setFileBuffer(buffer);
      setPreview(result);
    } catch (caught) {
      setFileBuffer(null);
      setError(errorMessage(caught));
    } finally {
      setIsReading(false);
    }
  };

  const visibleColumns = preview
    ? Math.min(preview.totalColumns, TRANSACTION_PREVIEW_LIMITS.previewColumns)
    : 0;
  const visibleColumnLabels = Array.from({ length: visibleColumns }, (_, index) =>
    transactionColumnLabel(index),
  );
  const displayRows = preview ? keyedRows(preview.previewRows) : [];

  return (
    <div className={styles.previewStack}>
      <section className={styles.uploadPanel} aria-labelledby="transaction-upload-title">
        <div className={styles.uploadCopy}>
          <span className={styles.kicker}>Task 19 · Import Validation</span>
          <h2 id="transaction-upload-title">اختر ملف معاملات العملاء</h2>
          <p>
            المعاينة والـ Mapping والـ Validation تتم داخل المتصفح فقط. الملف ومحتواه لا يتم رفعهما إلى
            السيرفر، ولا يتم إنشاء أي معاملات في قاعدة البيانات في هذه الخطوة.
          </p>
        </div>

        {canManage ? (
          <div className={styles.fileControl}>
            <label htmlFor="transaction-file">CSV أو XLSX</label>
            <input
              ref={inputRef}
              id="transaction-file"
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              aria-describedby="transaction-file-help"
              disabled={isReading}
              onChange={(event) => void handleFile(event.currentTarget.files?.[0])}
            />
            <p id="transaction-file-help">
              الحد الأقصى للملف {Math.round(TRANSACTION_PREVIEW_LIMITS.maxFileBytes / 1024 / 1024)} MB.
              نعرض أول {TRANSACTION_PREVIEW_LIMITS.previewRows} صفًا وأول {TRANSACTION_PREVIEW_LIMITS.previewColumns}
              عمودًا، بينما Validation يفحص كل الصفوف غير الفارغة بعد اكتمال الـ Mapping.
            </p>
          </div>
        ) : (
          <div className={styles.readOnlyNotice}>
            صلاحيتك في هذا البزنس للعرض فقط. رفع ملفات معاملات العملاء متاح للأدمن أو مالك البزنس.
          </div>
        )}
      </section>

      {isReading && (
        <div className={styles.statusBox} role="status" aria-live="polite">
          جاري قراءة الملف وبناء المعاينة…
        </div>
      )}

      {error && (
        <div className={styles.errorBox} role="alert">
          <strong>تعذر معاينة الملف</strong>
          <p>{error}</p>
          <button type="button" onClick={reset}>
            اختيار ملف آخر
          </button>
        </div>
      )}

      {preview && !error && (
        <>
          <section className={styles.resultPanel} aria-labelledby="transaction-preview-title">
            <div className={styles.resultHeading}>
              <div>
                <span className={styles.kicker}>تمت القراءة محليًا</span>
                <h2 id="transaction-preview-title">معاينة الملف</h2>
                <p>بعد الـ Mapping يمكنك تشغيل Validation. Duplicate Protection وImport ما زالا خارج هذه الخطوة.</p>
              </div>
              <button type="button" className={styles.secondaryButton} onClick={reset}>
                تغيير الملف
              </button>
            </div>

            <dl className={styles.metaGrid}>
              <div>
                <dt>اسم الملف</dt>
                <dd dir="ltr">{preview.fileName}</dd>
              </div>
              <div>
                <dt>النوع والحجم</dt>
                <dd dir="ltr">
                  {preview.fileType.toUpperCase()} · {fileSizeLabel(preview.fileSize)}
                </dd>
              </div>
              <div>
                <dt>الصفوف المحللة</dt>
                <dd>{preview.totalRows}</dd>
              </div>
              <div>
                <dt>الأعمدة المكتشفة</dt>
                <dd>{preview.totalColumns}</dd>
              </div>
              {preview.fileType === "xlsx" ? (
                <div>
                  <dt>Worksheet</dt>
                  <dd dir="ltr">{preview.sheetName ?? "—"}</dd>
                </div>
              ) : (
                <div>
                  <dt>الفاصل المكتشف</dt>
                  <dd>{delimiterLabel(preview.delimiter)}</dd>
                </div>
              )}
            </dl>

            {preview.previewRows.length === 0 || visibleColumns === 0 ? (
              <div className={styles.emptyPreview}>الملف صالح للقراءة لكنه لا يحتوي على صفوف بيانات قابلة للعرض.</div>
            ) : (
              <div
                className={styles.tableShell}
                tabIndex={0}
                role="group"
                aria-label="منطقة تمرير جدول معاينة ملف المعاملات"
              >
                <table className={styles.previewTable} aria-label="جدول معاينة ملف المعاملات">
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      {visibleColumnLabels.map((label) => (
                        <th scope="col" key={label} dir="ltr">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.map(({ key, row }, rowIndex) => (
                      <tr key={key}>
                        <th scope="row">{rowIndex + 1}</th>
                        {visibleColumnLabels.map((label, columnIndex) => (
                          <td key={`${key}:${label}`} dir="auto">
                            {row[columnIndex] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(preview.truncatedRows || preview.truncatedColumns) && (
              <p className={styles.truncationNote}>
                هذه معاينة فقط. تم تحليل الملف كاملًا لإظهار الإجماليات، لكن الجدول يعرض نطاقًا محدودًا لحماية
                أداء المتصفح.
              </p>
            )}
          </section>

          {canManage && fileBuffer && preview.previewRows.length > 0 && visibleColumns > 0 && (
            <TransactionColumnMapper
              key={`${preview.fileName}:${preview.fileSize}:${preview.totalRows}:${preview.totalColumns}`}
              preview={preview}
              fileBuffer={fileBuffer}
            />
          )}
        </>
      )}
    </div>
  );
}
