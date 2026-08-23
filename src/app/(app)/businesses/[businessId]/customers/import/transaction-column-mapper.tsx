"use client";

import { useMemo, useState } from "react";
import {
  EMPTY_TRANSACTION_COLUMN_MAPPING,
  inspectTransactionColumnMapping,
  REQUIRED_TRANSACTION_FIELDS,
  setTransactionFieldColumn,
  TRANSACTION_FIELD_LABELS,
  type RequiredTransactionField,
  type TransactionColumnMapping,
} from "@/lib/business/transaction-column-mapping";
import {
  TRANSACTION_PREVIEW_LIMITS,
  type TransactionFilePreview,
} from "@/lib/business/transaction-preview";
import styles from "./transaction-import.module.css";

type TransactionColumnMapperProps = {
  preview: TransactionFilePreview;
};

function columnLabel(index: number) {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}

function sampleValue(preview: TransactionFilePreview, column: number) {
  for (const row of preview.previewRows) {
    const value = row[column]?.trim();
    if (value) return value;
  }
  return "";
}

function fieldDescription(field: RequiredTransactionField) {
  if (field === "customerEmail") return "العمود الذي يحتوي على بريد العميل.";
  if (field === "transactionDate") return "العمود الذي يحتوي على تاريخ المعاملة.";
  return "العمود الذي يحتوي على المبلغ المحصل.";
}

export function TransactionColumnMapper({ preview }: TransactionColumnMapperProps) {
  const [mapping, setMapping] = useState<TransactionColumnMapping>(EMPTY_TRANSACTION_COLUMN_MAPPING);
  const mappingState = inspectTransactionColumnMapping(mapping);
  const visibleColumns = Math.min(
    preview.totalColumns,
    TRANSACTION_PREVIEW_LIMITS.previewColumns,
  );

  const options = useMemo(
    () =>
      Array.from({ length: visibleColumns }, (_, column) => ({
        column,
        label: columnLabel(column),
        sample: sampleValue(preview, column),
      })),
    [preview, visibleColumns],
  );

  const setField = (field: RequiredTransactionField, value: string) => {
    const column = value === "" ? null : Number(value);
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

      <div className={styles.mappingGrid}>
        {REQUIRED_TRANSACTION_FIELDS.map((field) => {
          const selected = mapping[field];
          return (
            <div className={styles.mappingField} key={field}>
              <label htmlFor={`mapping-${field}`}>{TRANSACTION_FIELD_LABELS[field]}</label>
              <p>{fieldDescription(field)}</p>
              <select
                id={`mapping-${field}`}
                value={selected ?? ""}
                onChange={(event) => setField(field, event.currentTarget.value)}
              >
                <option value="">اختر عمودًا</option>
                {options.map((option) => (
                  <option key={option.column} value={option.column}>
                    {option.label}
                    {option.sample ? ` — ${option.sample.slice(0, 48)}` : ""}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {mappingState.hasDuplicateColumns && (
        <div className={styles.mappingError} role="alert">
          لا يمكن استخدام نفس العمود لأكثر من حقل مطلوب. اختر عمودًا مختلفًا لكل حقل.
        </div>
      )}

      {!mappingState.hasDuplicateColumns && mappingState.missingFields.length > 0 && (
        <p className={styles.mappingHint}>
          الحقول المتبقية: {mappingState.missingFields.map((field) => TRANSACTION_FIELD_LABELS[field]).join("، ")}.
        </p>
      )}

      {mappingState.isComplete && (
        <div className={styles.mappingSummary} aria-label="ملخص Column Mapping">
          {REQUIRED_TRANSACTION_FIELDS.map((field) => (
            <div key={field}>
              <span>{TRANSACTION_FIELD_LABELS[field]}</span>
              <strong dir="ltr">Column {columnLabel(mapping[field] as number)}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
