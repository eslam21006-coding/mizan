"use client";

import { useMemo, useState } from "react";
import {
  buildTransactionColumnChoices,
  EMPTY_TRANSACTION_COLUMN_MAPPING,
  inspectTransactionColumnMapping,
  REQUIRED_TRANSACTION_FIELDS,
  setTransactionFieldColumn,
  TRANSACTION_FIELD_LABELS,
  TRANSACTION_MAPPING_FIELDS,
  TRANSACTION_NATIVE_MAPPING_OPTION_LIMIT,
  type TransactionColumnMapping,
  type TransactionMappingField,
} from "@/lib/business/transaction-column-mapping";
import { transactionColumnLabel } from "@/lib/business/transaction-columns";
import {
  TRANSACTION_PREVIEW_LIMITS,
  type TransactionFilePreview,
} from "@/lib/business/transaction-preview";
import { TransactionImportValidator } from "./transaction-import-validator";
import styles from "./transaction-import.module.css";

type TransactionColumnMapperProps = {
  businessId: string;
  baseCurrency: string;
  preview: TransactionFilePreview;
  fileBuffer: ArrayBuffer;
  importBusy: boolean;
  onImportBusyChange: (busy: boolean) => void;
};

function fieldDescription(field: TransactionMappingField) {
  if (field === "customerEmail") return "العمود الذي يحتوي على بريد العميل.";
  if (field === "transactionDate") return "العمود الذي يحتوي على تاريخ أو توقيت المعاملة كما صدر من بوابة الدفع.";
  if (field === "amountCollected") return "العمود الذي يحتوي على المبلغ المحصل.";
  if (field === "transactionId") {
    return "اختياري. اربطه إذا كان تصدير بوابة الدفع يحتوي على Transaction ID ثابت.";
  }
  return "اختياري. إذا كان الملف يحتوي Currency فاربطه حتى يرفض Mizan أي صف بعملة مختلفة عن عملة البزنس.";
}

function emptyOptionLabel(field: TransactionMappingField, required: boolean) {
  if (required) return "اختر عمودًا";
  if (field === "transactionId") return "بدون Transaction ID";
  return "بدون Currency column";
}

function sampleValue(preview: TransactionFilePreview, column: number) {
  if (column < 0 || column >= TRANSACTION_PREVIEW_LIMITS.previewColumns) return "";
  for (const row of preview.previewRows) {
    const value = row[column]?.trim();
    if (value) return value;
  }
  return "";
}

export function TransactionColumnMapper({
  businessId,
  baseCurrency,
  preview,
  fileBuffer,
  importBusy,
  onImportBusyChange,
}: TransactionColumnMapperProps) {
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

  const setSelectField = (field: TransactionMappingField, value: string) => {
    if (importBusy) return;
    if (value === "") {
      setMapping((current) => setTransactionFieldColumn(current, field, null));
      return;
    }

    const column = Number(value);
    if (!Number.isSafeInteger(column) || column < 0 || column >= preview.totalColumns) return;
    setMapping((current) => setTransactionFieldColumn(current, field, column));
  };

  const setDirectField = (field: TransactionMappingField, value: string) => {
    if (importBusy) return;
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

  const validationKey = mappingState.isComplete
    ? `${mapping.customerEmail}:${mapping.transactionDate}:${mapping.amountCollected}:${mapping.transactionId ?? "none"}:${mapping.currency ?? "none"}`
    : "incomplete";

  return (
    <>
      <section className={styles.mappingPanel} aria-labelledby="transaction-mapping-title">
        <div className={styles.mappingHeading}>
          <div>
            <span className={styles.kicker}>Task 20 · Mapping + Duplicate Key</span>
            <h2 id="transaction-mapping-title">اربط أعمدة الملف بالحقول المطلوبة</h2>
            <p>
              الحقول الثلاثة الأولى مطلوبة. Transaction ID وCurrency اختياريان؛ Currency المربوط يُفحص صفًا
              بصف مقابل عملة البزنس الأساسية {baseCurrency}.
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
            {TRANSACTION_MAPPING_FIELDS.map((field) => {
              const selected = mapping[field] ?? null;
              const selectedSample = selected === null ? "" : sampleValue(preview, selected);
              const controlId = `mapping-${field}`;
              const helpId = `mapping-${field}-help`;
              const required = REQUIRED_TRANSACTION_FIELDS.includes(
                field as (typeof REQUIRED_TRANSACTION_FIELDS)[number],
              );

              return (
                <div className={styles.mappingField} key={field}>
                  <label htmlFor={controlId}>
                    {TRANSACTION_FIELD_LABELS[field]}
                    {!required && " · اختياري"}
                  </label>
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
                        disabled={importBusy}
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
                      disabled={importBusy}
                      onChange={(event) => setSelectField(field, event.currentTarget.value)}
                    >
                      <option value="">{emptyOptionLabel(field, required)}</option>
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
            لا يمكن استخدام نفس العمود لأكثر من حقل. اختر عمودًا مختلفًا لكل Mapping.
          </div>
        )}

        {hasValidColumnCount &&
          !mappingState.hasDuplicateColumns &&
          mappingState.missingFields.length > 0 && (
            <p className={styles.mappingHint}>
              الحقول المطلوبة المتبقية:{" "}
              {mappingState.missingFields.map((field) => TRANSACTION_FIELD_LABELS[field]).join("، ")}.
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
            <div>
              <span>{TRANSACTION_FIELD_LABELS.transactionId}</span>
              <strong dir="ltr">
                {mapping.transactionId === null || mapping.transactionId === undefined
                  ? "Candidate duplicate check"
                  : `Column ${transactionColumnLabel(mapping.transactionId)}`}
              </strong>
            </div>
            <div>
              <span>{TRANSACTION_FIELD_LABELS.currency}</span>
              <strong dir="ltr">
                {mapping.currency === null || mapping.currency === undefined
                  ? `Import confirmation → ${baseCurrency}`
                  : `Column ${transactionColumnLabel(mapping.currency)}`}
              </strong>
            </div>
          </div>
        )}
      </section>

      {hasValidColumnCount && mappingState.isComplete && (
        <TransactionImportValidator
          key={validationKey}
          businessId={businessId}
          baseCurrency={baseCurrency}
          preview={preview}
          fileBuffer={fileBuffer}
          mapping={mapping}
          onImportBusyChange={onImportBusyChange}
        />
      )}
    </>
  );
}
