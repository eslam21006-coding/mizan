"use client";

import { useMemo, useState } from "react";
import {
  buildTransactionColumnChoices,
  EMPTY_TRANSACTION_COLUMN_MAPPING,
  inspectTransactionColumnMapping,
  REQUIRED_TRANSACTION_FIELDS,
  setTransactionFieldColumn,
  TRANSACTION_FIELD_LABELS,
  TRANSACTION_NATIVE_MAPPING_OPTION_LIMIT,
  type RequiredTransactionField,
  type TransactionColumnMapping,
} from "@/lib/business/transaction-column-mapping";
import { transactionColumnLabel } from "@/lib/business/transaction-columns";
import {
  TRANSACTION_PREVIEW_LIMITS,
  type TransactionFilePreview,
} from "@/lib/business/transaction-preview";
import styles from "./transaction-import.module.css";

type TransactionColumnMapperProps = {
  preview: TransactionFilePreview;
};

function fieldDescription(field: RequiredTransactionField) {
  if (field === "customerEmail") return "العمود الذي يحتوي على بريد العميل.";
  if (field === "transactionDate") return "العمود الذي يحتوي على تاريخ المعاملة.";
  return "العمود الذي يحتوي على المبلغ المحصل.";
}

function sampleValue(preview: TransactionFilePreview, column: number) {
  if (column < 0 || column >= TRANSACTION_PREVIEW_LIMITS.previewColumns) return "";
  for (const row of preview.previewRows) {
    const value = row[column]?.trim();
    if (value) return value;
  }
  return "";
}

export function TransactionColumnMapper({ preview }: TransactionColumnMapperProps) {
  const [mapping, setMapping] = useState<TransactionColumnMapping>(EMPTY_TRANSACTION_COLUMN_MAPPING);
  const mappingState = inspectTransactionColumnMapping(mapping);
  const hasValidColumnCount = Number.isSafeInteger(preview.totalColumns) && preview.totalColumns > 0;
  const usesDirectColumnEntry =
    hasValidColumnCount && preview.totalColumns > TRANSACTION_NATIVE_MAPPING_OPTION_LIMIT;

  const options = useMemo(() => {
    if (!hasValidColumnCount || usesDirectColumnEntry) return [];
    return buildTransactionColumnChoices({
      totalColumns: preview.totalColumns,
      previewRows: preview.previewRows,
      sampleColumnLimit: TRANSACTION_PREVIEW_LIMITS.previewColumns,
    });
  }, [preview, hasValidColumnCount, usesDirectColumnEntry]);

  const setSelectField = (field: RequiredTransactionField, value: string) => {
    if (value === "") {
      setMapping((current) => setTransactionFieldColumn(current, field, null));
      return;
    }

    const column = Number(value);
    if (!Number.isSafeInteger(column) || column < 0 || column >= preview.totalColumns) return;
    setMapping((current) => setTransactionFieldColumn(current, field, column));
  };

  const setDirectField = (field: RequiredTransactionField, value: string) => {
    if (value.trim() === "") {
      setMapping((current) => setTransactionFieldColumn(current, field, null));
      return;
    }

    const oneBasedColumn = Number(value);
    const column = oneBasedColumn - 1;
    if (
      !Number.isSafeInteger(oneBasedColumn) ||
      oneBasedColumn < 1 ||
      oneBasedColumn > preview.totalColumns
    ) {
      setMapping((current) => setTransactionFieldColumn(current, field, null));
      return;
    }

    setMapping((current) => setTransactionFieldColumn(current, field, column));
  };

  return (
    <section className={styles.mappingPanel} aria-labelledby="transaction-mapping-title">
      <div className={styles.mappingHeading}>
        <div>
          <span className={styles.kicker}>Task 18 · Column Mapping</span>
          <h2 id="transaction-mapping-title">اربط أعمدة الملف بالحقول المطلوبة</h2>
          <p>
            اختر العمود الصحيح لكل حقل. لا يتم حفظ البيانات أو استيرادها في هذه الخطوة، ولا يتم تنفيذ
            Validation أو Duplicate Protection بعد.
          </p>
        </div>
        <span className={mappingState.isComplete ? styles.mappingReady : styles.mappingPending}>
          {mappingState.isComplete ? "Mapping مكتمل" : "Mapping غير مكتمل"}
        </span>
      </div>

      {!hasValidColumnCount ? (
        <div className={styles.mappingError} role="alert">
          عدد الأعمدة في الملف غير صالح للـ Mapping. اختر ملفًا آخر.
        </div>
      ) : (
        <div className={styles.mappingGrid}>
          {REQUIRED_TRANSACTION_FIELDS.map((field) => {
            const selected = mapping[field];
            const selectedSample = selected === null ? "" : sampleValue(preview, selected);
            const controlId = `mapping-${field}`;
            const helpId = `mapping-${field}-help`;

            return (
              <div className={styles.mappingField} key={field}>
                <label htmlFor={controlId}>{TRANSACTION_FIELD_LABELS[field]}</label>
                <p>{fieldDescription(field)}</p>

                {usesDirectColumnEntry ? (
                  <>
                    <input
                      id={controlId}
                      type="number"
                      min={1}
                      max={preview.totalColumns}
                      step={1}
                      inputMode="numeric"
                      value={selected === null ? "" : selected + 1}
                      aria-describedby={helpId}
                      onChange={(event) => setDirectField(field, event.currentTarget.value)}
                    />
                    <p id={helpId}>
                      اكتب رقم العمود من 1 إلى {preview.totalColumns}.
                      {selected !== null
                        ? ` المحدد: Column ${transactionColumnLabel(selected)}${selectedSample ? ` — ${selectedSample.slice(0, 48)}` : ""}`
                        : ""}
                    </p>
                  </>
                ) : (
                  <select
                    id={controlId}
                    value={selected ?? ""}
                    onChange={(event) => setSelectField(field, event.currentTarget.value)}
                  >
                    <option value="">اختر عمودًا</option>
                    {options.map((option) => (
                      <option key={option.column} value={option.column}>
                        {option.label}
                        {option.sample ? ` — ${option.sample.slice(0, 48)}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      )}

      {hasValidColumnCount && mappingState.hasDuplicateColumns && (
        <div className={styles.mappingError} role="alert">
          لا يمكن استخدام نفس العمود لأكثر من حقل مطلوب. اختر عمودًا مختلفًا لكل حقل.
        </div>
      )}

      {hasValidColumnCount &&
        !mappingState.hasDuplicateColumns &&
        mappingState.missingFields.length > 0 && (
          <p className={styles.mappingHint}>
            الحقول المتبقية: {mappingState.missingFields.map((field) => TRANSACTION_FIELD_LABELS[field]).join("، ")}.
          </p>
        )}

      {hasValidColumnCount && mappingState.isComplete && (
        <div className={styles.mappingSummary}>
          {REQUIRED_TRANSACTION_FIELDS.map((field) => (
            <div key={field}>
              <span>{TRANSACTION_FIELD_LABELS[field]}</span>
              <strong dir="ltr">Column {transactionColumnLabel(mapping[field] as number)}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
