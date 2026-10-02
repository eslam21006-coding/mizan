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

export const EXPENSE_SETUP_CATEGORY_OPTIONS: ReadonlyArray<{
  value: ExpenseCategory;
  label: string;
  description: string;
  examples: readonly string[];
}> = [
  {
    value: "acquisition",
    label: "الإعلان وجلب العملاء",
    description: "أي تكلفة هدفها الوصول إلى عميل جديد أو إتمام البيع.",
    examples: ["Meta Ads", "Google Ads", "Agency", "فريق المبيعات", "Appointment Setters"],
  },
  {
    value: "fulfillment",
    label: "تقديم الخدمة للعملاء",
    description: "التكاليف المرتبطة بتقديم المنتج أو الخدمة وخدمة العميل بعد البيع.",
    examples: ["Coach", "Support", "Instructor", "Materials", "Shipping"],
  },
  {
    value: "overhead",
    label: "تشغيل البزنس",
    description: "التكاليف العامة اللازمة لتشغيل البزنس وإدارته.",
    examples: ["Employees", "Software", "Rent", "Accounting", "Management"],
  },
  {
    value: "financial",
    label: "تكاليف مالية",
    description: "الرسوم والالتزامات المالية المرتبطة بتحصيل الأموال وتشغيل البزنس.",
    examples: ["Payment processor fees", "Taxes"],
  },
];

export type ExpenseCategoryCounts = Readonly<Record<ExpenseCategory, number>>;

export type ExpenseCreationRequestIds = Readonly<Record<ExpenseCategory, string>>;

export type SetupExpenseItem = {
  id: string;
  name: string;
  category: ExpenseCategory;
  costBehavior: ExpenseCostBehavior;
  isActive: boolean;
};


export type ExpenseSetupReviewResolution = {
  resolved: boolean;
  unresolvedCategories: ExpenseCategory[];
  invalidNoneCategories: ExpenseCategory[];
};

/** Resolves whether every expense category is backed by an active row or an explicit reviewed-none claim. */
export function resolveExpenseSetupReview(
  activeCounts: ExpenseCategoryCounts,
  explicitNoneCategories: readonly ExpenseCategory[],
): ExpenseSetupReviewResolution {
  const explicitNone = new Set(explicitNoneCategories);
  const invalidNoneCategories = EXPENSE_CATEGORIES.filter(
    (category) => activeCounts[category] > 0 && explicitNone.has(category),
  );
  const unresolvedCategories = EXPENSE_CATEGORIES.filter(
    (category) => activeCounts[category] <= 0 && !explicitNone.has(category),
  );

  return {
    resolved: invalidNoneCategories.length === 0 && unresolvedCategories.length === 0,
    unresolvedCategories,
    invalidNoneCategories,
  };
}

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
    label: "مبلغ ثابت تقريبًا",
    description: "تكلفة موجودة للشهر سواء زاد عدد العملاء أو قل.",
  },
  {
    value: "per_customer",
    label: "تزيد مع عدد العملاء",
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
