"use client";

import { useMemo, useState } from "react";
import {
  buildTransactionColumnChoices,
  EMPTY_TRANSACTION_COLUMN_MAPPING,
  inspectTransactionColumnMapping,
  REQUIRED_TRANSACTION_FIELDS,
  setTransactionFieldColumn,
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

const FIELD_LABELS: Record<TransactionMappingField, string> = {
  customerEmail: "البريد الإلكتروني للعميل",
  transactionDate: "تاريخ المعاملة",
  amountCollected: "المبلغ المحصل",
  transactionId: "رقم المعاملة",
  currency: "العملة",
};

function fieldDescription(field: TransactionMappingField, baseCurrency: string) {
  if (field === "customerEmail") return "اختر العمود الذي يحتوي على بريد العميل.";
  if (field === "transactionDate") return "اختر العمود الذي يحتوي على تاريخ أو توقيت المعاملة.";
  if (field === "amountCollected") return "اختر العمود الذي يحتوي على قيمة المعاملة بدون رمز العملة.";
  if (field === "transactionId") {
    return "اختياري. يفضل استخدامه لأنه يجعل اكتشاف المعاملات المكررة أكثر دقة.";
  }
  return `اختياري. إذا لم يوجد عمود للعملة، ستؤكد أن جميع المعاملات بعملة ${baseCurrency}.`;
}

function emptyOptionLabel(field: TransactionMappingField, required: boolean) {
  if (required) return "اختر العمود";
  if (field === "transactionId") return "لا يوجد رقم معاملة";
  return "لا يوجد عمود للعملة";
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
            <span className={styles.kicker}>الخطوة 4</span>
            <h2 id="transaction-mapping-title">طابق أعمدة ملفك</h2>
            <p>
              حدد العمود الذي يحتوي على كل معلومة. أول ثلاثة حقول مطلوبة، ورقم المعاملة والعملة اختياريان.
            </p>
          </div>
          <span className={mappingState.isComplete ? styles.mappingReady : styles.mappingPending}>
            {mappingState.isComplete ? "الأعمدة مكتملة" : "أكمل الأعمدة المطلوبة"}
          </span>
        </div>

        {!hasValidColumnCount ? (
          <div className={styles.mappingError} role="alert">
            تعذر قراءة أعمدة الملف. اختر ملفًا آخر.
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
                    {FIELD_LABELS[field]}
                    {!required && " · اختياري"}
                  </label>
                  <p>{fieldDescription(field, baseCurrency)}</p>

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
                          ? ` المحدد: العمود ${transactionColumnLabel(selected)}${selectedSample ? ` — ${selectedSample.slice(0, 48)}` : ""}`
                          : ""}
                      </p>
                    </>
                  ) : (
                    <select
                      id={controlId}
                      aria-label={FIELD_LABELS[field]}
                      value={selected ?? ""}
                      disabled={importBusy}
                      onChange={(event) => setSelectField(field, event.currentTarget.value)}
                    >
                      <option value="">{emptyOptionLabel(field, required)}</option>
                      {options.map((option) => (
                        <option key={option.column} value={option.column}>
                          العمود {option.label}
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
            لا يمكن استخدام نفس العمود لأكثر من معلومة. اختر عمودًا مختلفًا لكل حقل.
          </div>
        )}

        {hasValidColumnCount &&
          !mappingState.hasDuplicateColumns &&
          mappingState.missingFields.length > 0 && (
            <p className={styles.mappingHint}>
              الحقول المطلوبة المتبقية: {mappingState.missingFields.map((field) => FIELD_LABELS[field]).join("، ")}.
            </p>
          )}

        {hasValidColumnCount && mappingState.isComplete && (
          <div className={styles.mappingSummary}>
            {REQUIRED_TRANSACTION_FIELDS.map((field) => (
              <div key={field}>
                <span>{FIELD_LABELS[field]}</span>
                <strong>العمود {transactionColumnLabel(mapping[field] as number)}</strong>
              </div>
            ))}
            <div>
              <span>{FIELD_LABELS.transactionId}</span>
              <strong>
                {mapping.transactionId === null || mapping.transactionId === undefined
                  ? "سيتم التحقق من التكرار من البيانات المتاحة"
                  : `العمود ${transactionColumnLabel(mapping.transactionId)}`}
              </strong>
            </div>
            <div>
              <span>{FIELD_LABELS.currency}</span>
              <strong>
                {mapping.currency === null || mapping.currency === undefined
                  ? `ستؤكد عملة الملف: ${baseCurrency}`
                  : `العمود ${transactionColumnLabel(mapping.currency)}`}
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
