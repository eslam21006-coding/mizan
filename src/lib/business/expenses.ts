export const EXPENSE_CATEGORIES = [
  "acquisition",
  "fulfillment",
  "overhead",
  "financial",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_OPTIONS: ReadonlyArray<{
  value: ExpenseCategory;
  label: string;
  description: string;
}> = [
  {
    value: "acquisition",
    label: "اكتساب العملاء",
    description: "إعلانات، تسويق، مبيعات، وأي تكلفة هدفها جلب عميل جديد.",
  },
  {
    value: "fulfillment",
    label: "التنفيذ وخدمة العملاء",
    description: "تكاليف تقديم الخدمة أو المنتج ومتابعة العملاء بعد البيع.",
  },
  {
    value: "overhead",
    label: "المصاريف التشغيلية العامة",
    description: "إدارة، رواتب إدارية، برامج، إيجار، محاسبة، وتشغيل عام.",
  },
  {
    value: "financial",
    label: "المصاريف المالية",
    description: "مثل رسوم بوابات الدفع والضرائب والمصاريف المالية الأخرى.",
  },
];

export const EXPENSE_COST_BEHAVIORS = [
  "fixed_monthly",
  "per_customer",
  "percentage_revenue",
] as const;

export type ExpenseCostBehavior = (typeof EXPENSE_COST_BEHAVIORS)[number];

export const EXPENSE_COST_BEHAVIOR_OPTIONS: ReadonlyArray<{
  value: ExpenseCostBehavior;
  label: string;
  description: string;
}> = [
  {
    value: "fixed_monthly",
    label: "ثابت شهريًا",
    description: "تكلفة موجودة للشهر سواء زاد عدد العملاء أو قل.",
  },
  {
    value: "per_customer",
    label: "لكل عميل",
    description: "تكلفة متغيرة ترتبط بعدد العملاء الذين تخدمهم.",
  },
  {
    value: "percentage_revenue",
    label: "نسبة من الإيراد",
    description: "تكلفة متغيرة ترتفع أو تنخفض مع الإيراد المحصل.",
  },
];

export function normalizeExpenseName(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const length = [...normalized].length;

  return length >= 1 && length <= 120 ? normalized : null;
}

export function parseExpenseCategory(value: unknown): ExpenseCategory | null {
  const candidate = String(value ?? "").trim();
  return EXPENSE_CATEGORIES.includes(candidate as ExpenseCategory)
    ? (candidate as ExpenseCategory)
    : null;
}

export function parseExpenseCostBehavior(value: unknown): ExpenseCostBehavior | null {
  const candidate = String(value ?? "").trim();
  return EXPENSE_COST_BEHAVIORS.includes(candidate as ExpenseCostBehavior)
    ? (candidate as ExpenseCostBehavior)
    : null;
}

export function isVariableExpenseBehavior(behavior: ExpenseCostBehavior) {
  return behavior === "per_customer" || behavior === "percentage_revenue";
}
