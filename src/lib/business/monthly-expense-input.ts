import { parseCustomerCountBasis, parseOptionalDecimalInput } from "./monthly.ts";

export type ParsedMonthlyExpense =
  | {
      kind: "entry";
      entry: {
        expense_item_id: string;
        display_value: string | null;
        customer_count_basis: "new_customers" | "total_paying_customers" | null;
      };
    }
  | { kind: "skip" }
  | { kind: "error"; field: string; message: string };

/** Shared, pure expense-input validation; no client behavior label is ever authoritative. */
export function parseMonthlyExpenseInput(input: {
  id: string;
  valueFields: readonly FormDataEntryValue[];
  basisFields: readonly FormDataEntryValue[];
  behavior: string | null;
  setupDraft: boolean;
  existingSavedRow: boolean;
}): ParsedMonthlyExpense {
  const { id } = input;
  if (input.valueFields.length > 1) {
    return { kind: "error", field: `expense_value_${id}`, message: "تكرر حقل قيمة المصروف." };
  }
  const rawValue = input.valueFields[0];
  if (rawValue instanceof File) {
    return { kind: "error", field: `expense_value_${id}`, message: "قيمة المصروف غير صالحة." };
  }
  const parsedValue = parseOptionalDecimalInput(rawValue);
  if (!parsedValue.ok) {
    return { kind: "error", field: `expense_value_${id}`, message: "أدخل تكلفة غير سالبة." };
  }
  if (input.basisFields.length > 1 || input.basisFields[0] instanceof File) {
    return { kind: "error", field: `expense_basis_${id}`, message: "اختر أساسًا واحدًا صحيحًا لعدد العملاء." };
  }
  const rawBasis = String(input.basisFields[0] ?? "").trim();
  const basis = rawBasis ? parseCustomerCountBasis(rawBasis) : null;
  if (rawBasis && !basis) {
    return { kind: "error", field: `expense_basis_${id}`, message: "اختر أساسًا صحيحًا لعدد العملاء." };
  }

  if (input.setupDraft) {
    if (input.behavior === "per_customer" && parsedValue.value !== null && !basis) {
      return { kind: "error", field: `expense_basis_${id}`, message: "اختر أساس عدد العملاء لهذا المصروف." };
    }
    if (input.behavior !== "per_customer" && basis) {
      return { kind: "error", field: `expense_basis_${id}`, message: "أساس العملاء صالح فقط للمصروفات التي تزيد مع العملاء." };
    }
    if (input.behavior === "per_customer" && parsedValue.value === null && !basis) {
      if (input.existingSavedRow) {
        return { kind: "error", field: `expense_basis_${id}`, message: "هذا المصروف محفوظ بالفعل؛ اختر أساسه لحفظ التعديل." };
      }
      return { kind: "skip" };
    }
  }

  return {
    kind: "entry",
    entry: {
      expense_item_id: id,
      display_value: parsedValue.value,
      customer_count_basis: basis,
    },
  };
}
