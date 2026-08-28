import type {
  CalculatedMetric,
  CalculationExpenseCategory,
  CoreCalculationInput,
  CoreCalculationResult,
  ExactRatio,
} from "./calculations";

export type MetricAuditValue =
  | { kind: "money"; metric: CalculatedMetric<string> }
  | { kind: "count"; metric: CalculatedMetric<number> }
  | { kind: "money_ratio"; metric: CalculatedMetric<ExactRatio> }
  | { kind: "percent_ratio"; metric: CalculatedMetric<ExactRatio> }
  | { kind: "multiple_ratio"; metric: CalculatedMetric<ExactRatio> };

export type MetricAuditLine = {
  id: string;
  label: string;
  lineType: "input" | "component" | "subtotal";
  value: MetricAuditValue;
};

export type MetricAudit = {
  key: CoreMetricAuditKey;
  title: string;
  formula: string;
  source: string;
  lines: MetricAuditLine[];
  result: MetricAuditValue;
  note?: string;
};

export type CoreMetricAuditKey =
  | "grossCashCollected"
  | "refunds"
  | "netCashCollected"
  | "newCustomers"
  | "totalPayingCustomers"
  | "returningCustomers"
  | "acquisitionCosts"
  | "fulfillmentCosts"
  | "overheadCosts"
  | "financialCosts"
  | "allBusinessCosts"
  | "realNetProfit"
  | "realNetProfitMargin"
  | "contributionProfit"
  | "contributionMargin"
  | "mediaCac"
  | "acquisitionCac"
  | "ultimateCac"
  | "revenuePerPayingCustomer"
  | "revenuePerNewCustomer"
  | "mer";

export type CoreMetricAudits = Record<CoreMetricAuditKey, MetricAudit>;

const CATEGORY_LABELS: Record<CalculationExpenseCategory, string> = {
  acquisition: "تكاليف الاكتساب",
  fulfillment: "تكاليف التنفيذ وخدمة العملاء",
  overhead: "المصاريف التشغيلية العامة",
  financial: "المصاريف المالية",
};

function inputMoney(value: string | null | undefined): CalculatedMetric<string> {
  return value === null || value === undefined
    ? { available: false, reason: "INPUT_UNAVAILABLE" }
    : { available: true, value };
}

function money(metric: CalculatedMetric<string>): MetricAuditValue {
  return { kind: "money", metric };
}

function count(metric: CalculatedMetric<number>): MetricAuditValue {
  return { kind: "count", metric };
}

function moneyRatio(metric: CalculatedMetric<ExactRatio>): MetricAuditValue {
  return { kind: "money_ratio", metric };
}

function percentRatio(metric: CalculatedMetric<ExactRatio>): MetricAuditValue {
  return { kind: "percent_ratio", metric };
}

function multipleRatio(metric: CalculatedMetric<ExactRatio>): MetricAuditValue {
  return { kind: "multiple_ratio", metric };
}

function categoryAudit(
  category: CalculationExpenseCategory,
  result: CoreCalculationResult,
): MetricAudit {
  const lines = result.expensesByItem
    .filter((expense) => expense.category === category)
    .map((expense) => ({
      id: expense.id,
      label: expense.name,
      lineType: "component" as const,
      value: money(expense.amount),
    }));

  return {
    key: `${category}Costs` as CoreMetricAuditKey,
    title: CATEGORY_LABELS[category],
    formula: `مجموع بنود ${CATEGORY_LABELS[category]}`,
    source: "بنود المصروفات المحفوظة للشهر بعد تطبيق سلوك كل مصروف داخل محرك الحساب المركزي.",
    lines,
    result: money(result.expensesByCategory[category]),
  };
}

/**
 * Builds human-readable audit trails from the exact input/result pair used by the core calculator.
 * This function never recalculates a financial metric; it only exposes operands, subtotals,
 * formulas, and provenance that the calculation engine already used.
 */
export function createCoreMetricAudits(
  result: CoreCalculationResult,
  input: CoreCalculationInput,
): CoreMetricAudits {
  const acquisitionCosts = categoryAudit("acquisition", result);
  const fulfillmentCosts = categoryAudit("fulfillment", result);
  const overheadCosts = categoryAudit("overhead", result);
  const financialCosts = categoryAudit("financial", result);
  const canonicalAdSpend = inputMoney(input.canonicalAdSpend);

  const revenueLines: MetricAuditLine[] = [
    ...result.revenueByStream.map((stream) => ({
      id: `gross-${stream.id}`,
      label: stream.name,
      lineType: "component" as const,
      value: money(stream.grossCashCollected),
    })),
    {
      id: "gross-unallocated",
      label: "تحصيل غير موزع على مصدر إيراد",
      lineType: "input",
      value: money(inputMoney(input.unallocatedGrossCashCollected)),
    },
  ];

  const refundLines: MetricAuditLine[] = [
    ...result.revenueByStream.map((stream) => ({
      id: `refund-${stream.id}`,
      label: stream.name,
      lineType: "component" as const,
      value: money(stream.refunds),
    })),
    {
      id: "refund-unallocated",
      label: "مرتجعات غير موزعة على مصدر إيراد",
      lineType: "input",
      value: money(inputMoney(input.unallocatedRefunds)),
    },
  ];

  const variableExpenseLines = result.expensesByItem
    .filter((expense) => expense.variable)
    .map((expense) => ({
      id: `variable-${expense.id}`,
      label: expense.name,
      lineType: "component" as const,
      value: money(expense.amount),
    }));

  return {
    grossCashCollected: {
      key: "grossCashCollected",
      title: "إجمالي الكاش المحصل قبل المرتجعات",
      formula: "مجموع التحصيل الفعلي من كل مصادر الإيراد + التحصيل غير الموزع",
      source: "أرقام التحصيل الشهرية المحفوظة فقط؛ لا يدخل فيها إيراد متعاقد عليه ولم يُحصّل.",
      lines: revenueLines,
      result: money(result.grossCashCollected),
    },
    refunds: {
      key: "refunds",
      title: "المرتجعات",
      formula: "مجموع المرتجعات الفعلية لكل مصادر الإيراد + المرتجعات غير الموزعة",
      source: "المرتجعات الشهرية المحفوظة كقيمة موجبة مضادة للإيراد، وليست مصروفًا.",
      lines: refundLines,
      result: money(result.refunds),
    },
    netCashCollected: {
      key: "netCashCollected",
      title: "صافي الكاش المحصل",
      formula: "إجمالي الكاش المحصل − المرتجعات",
      source: "محرك الحساب المركزي باستخدام التحصيل والمرتجعات الفعلية للفترة.",
      lines: [
        {
          id: "net-gross",
          label: "إجمالي الكاش المحصل",
          lineType: "subtotal",
          value: money(result.grossCashCollected),
        },
        {
          id: "net-refunds",
          label: "المرتجعات",
          lineType: "subtotal",
          value: money(result.refunds),
        },
      ],
      result: money(result.netCashCollected),
    },
    newCustomers: {
      key: "newCustomers",
      title: "العملاء الجدد",
      formula: "عدد العملاء الفريدين الذين يقع تاريخ اكتسابهم داخل الفترة",
      source: "قيمة العملاء الجدد المستخدمة فعليًا في محرك حساب هذا الشهر.",
      lines: [
        {
          id: "new-customers-input",
          label: "العملاء الجدد للفترة",
          lineType: "input",
          value: count(result.newCustomers),
        },
      ],
      result: count(result.newCustomers),
    },
    totalPayingCustomers: {
      key: "totalPayingCustomers",
      title: "إجمالي العملاء الدافعين",
      formula: "عدد العملاء الفريدين الذين لديهم تحصيل ناجح موجب داخل الفترة",
      source: "قيمة العملاء الدافعين المستخدمة فعليًا في محرك حساب هذا الشهر.",
      lines: [
        {
          id: "paying-customers-input",
          label: "العملاء الدافعون للفترة",
          lineType: "input",
          value: count(result.totalPayingCustomers),
        },
      ],
      result: count(result.totalPayingCustomers),
    },
    returningCustomers: {
      key: "returningCustomers",
      title: "العملاء العائدون",
      formula: "إجمالي العملاء الدافعين − العملاء الجدد",
      source: "مشتق داخل محرك الحساب المركزي من عددي العملاء المحفوظين للفترة.",
      lines: [
        {
          id: "returning-paying",
          label: "إجمالي العملاء الدافعين",
          lineType: "input",
          value: count(result.totalPayingCustomers),
        },
        {
          id: "returning-new",
          label: "العملاء الجدد",
          lineType: "input",
          value: count(result.newCustomers),
        },
      ],
      result: count(result.returningCustomers),
    },
    acquisitionCosts,
    fulfillmentCosts,
    overheadCosts,
    financialCosts,
    allBusinessCosts: {
      key: "allBusinessCosts",
      title: "إجمالي تكاليف البزنس",
      formula: "تكاليف الاكتساب + التنفيذ وخدمة العملاء + التشغيل العامة + المصاريف المالية",
      source: "مجاميع التصنيفات الأربعة الخارجة من محرك الحساب المركزي؛ المرتجعات لا تُحسب هنا مرة ثانية.",
      lines: [
        {
          id: "all-costs-acquisition",
          label: CATEGORY_LABELS.acquisition,
          lineType: "subtotal",
          value: acquisitionCosts.result,
        },
        {
          id: "all-costs-fulfillment",
          label: CATEGORY_LABELS.fulfillment,
          lineType: "subtotal",
          value: fulfillmentCosts.result,
        },
        {
          id: "all-costs-overhead",
          label: CATEGORY_LABELS.overhead,
          lineType: "subtotal",
          value: overheadCosts.result,
        },
        {
          id: "all-costs-financial",
          label: CATEGORY_LABELS.financial,
          lineType: "subtotal",
          value: financialCosts.result,
        },
      ],
      result: money(result.allBusinessCosts),
    },
    realNetProfit: {
      key: "realNetProfit",
      title: "صافي الربح الحقيقي",
      formula: "صافي الكاش المحصل − إجمالي تكاليف البزنس",
      source: "محرك الحساب المركزي بعد إدخال كل تصنيفات التكلفة الأربعة.",
      lines: [
        {
          id: "profit-net-cash",
          label: "صافي الكاش المحصل",
          lineType: "subtotal",
          value: money(result.netCashCollected),
        },
        {
          id: "profit-all-costs",
          label: "إجمالي تكاليف البزنس",
          lineType: "subtotal",
          value: money(result.allBusinessCosts),
        },
      ],
      result: money(result.realNetProfit),
    },
    realNetProfitMargin: {
      key: "realNetProfitMargin",
      title: "هامش صافي الربح الحقيقي",
      formula: "صافي الربح الحقيقي ÷ صافي الكاش المحصل",
      source: "النسبة الدقيقة من القيمتين الخارجتين من محرك الحساب؛ لا تُحسب إذا كان صافي الكاش غير موجب.",
      lines: [
        {
          id: "margin-profit",
          label: "صافي الربح الحقيقي",
          lineType: "subtotal",
          value: money(result.realNetProfit),
        },
        {
          id: "margin-net-cash",
          label: "صافي الكاش المحصل",
          lineType: "subtotal",
          value: money(result.netCashCollected),
        },
      ],
      result: percentRatio(result.realNetProfitMargin),
    },
    contributionProfit: {
      key: "contributionProfit",
      title: "ربح المساهمة",
      formula: "صافي الكاش المحصل − التكاليف المتغيرة",
      source: "التكاليف المتغيرة هي بنود Per Customer و Percentage of Revenue فقط؛ المصروفات الشهرية الثابتة مستبعدة.",
      lines: [
        {
          id: "contribution-net-cash",
          label: "صافي الكاش المحصل",
          lineType: "subtotal",
          value: money(result.netCashCollected),
        },
        ...variableExpenseLines,
        {
          id: "contribution-variable-costs",
          label: "إجمالي التكاليف المتغيرة",
          lineType: "subtotal",
          value: money(result.variableCosts),
        },
      ],
      result: money(result.contributionProfit),
    },
    contributionMargin: {
      key: "contributionMargin",
      title: "هامش المساهمة",
      formula: "ربح المساهمة ÷ صافي الكاش المحصل",
      source: "النسبة الدقيقة من نتائج محرك الحساب المركزي؛ لا تُحسب إذا كان صافي الكاش غير موجب.",
      lines: [
        {
          id: "contribution-margin-profit",
          label: "ربح المساهمة",
          lineType: "subtotal",
          value: money(result.contributionProfit),
        },
        {
          id: "contribution-margin-net-cash",
          label: "صافي الكاش المحصل",
          lineType: "subtotal",
          value: money(result.netCashCollected),
        },
      ],
      result: percentRatio(result.contributionMargin),
    },
    mediaCac: {
      key: "mediaCac",
      title: "Media CAC",
      formula: "إجمالي الإنفاق الإعلاني المعتمد ÷ العملاء الجدد",
      source: "الإنفاق الإعلاني الكانوني بعد مصالحة إنفاق البزنس والفانلز، بدون جمع نفس الإنفاق مرتين.",
      lines: [
        {
          id: "media-cac-ad-spend",
          label: "إجمالي الإنفاق الإعلاني المعتمد",
          lineType: "input",
          value: money(canonicalAdSpend),
        },
        {
          id: "media-cac-new-customers",
          label: "العملاء الجدد",
          lineType: "input",
          value: count(result.newCustomers),
        },
      ],
      result: moneyRatio(result.mediaCac),
    },
    acquisitionCac: {
      key: "acquisitionCac",
      title: "Acquisition CAC",
      formula: "تكاليف الاكتساب ÷ العملاء الجدد",
      source: "كل تكاليف التسويق والمبيعات والاكتساب المصنفة Acquisition داخل الشهر.",
      lines: [
        {
          id: "acquisition-cac-costs",
          label: "تكاليف الاكتساب",
          lineType: "subtotal",
          value: acquisitionCosts.result,
        },
        {
          id: "acquisition-cac-new-customers",
          label: "العملاء الجدد",
          lineType: "input",
          value: count(result.newCustomers),
        },
      ],
      result: moneyRatio(result.acquisitionCac),
    },
    ultimateCac: {
      key: "ultimateCac",
      title: "Ultimate CAC",
      formula: "إجمالي تكاليف البزنس ÷ العملاء الجدد",
      source: "التكاليف الكاملة للفترة من التصنيفات الأربعة، ثم عدد العملاء الجدد نفسه المستخدم في محرك الحساب.",
      lines: [
        {
          id: "ultimate-acquisition",
          label: CATEGORY_LABELS.acquisition,
          lineType: "subtotal",
          value: acquisitionCosts.result,
        },
        {
          id: "ultimate-fulfillment",
          label: CATEGORY_LABELS.fulfillment,
          lineType: "subtotal",
          value: fulfillmentCosts.result,
        },
        {
          id: "ultimate-overhead",
          label: CATEGORY_LABELS.overhead,
          lineType: "subtotal",
          value: overheadCosts.result,
        },
        {
          id: "ultimate-financial",
          label: CATEGORY_LABELS.financial,
          lineType: "subtotal",
          value: financialCosts.result,
        },
        {
          id: "ultimate-all-costs",
          label: "إجمالي تكاليف البزنس",
          lineType: "subtotal",
          value: money(result.allBusinessCosts),
        },
        {
          id: "ultimate-new-customers",
          label: "العملاء الجدد",
          lineType: "input",
          value: count(result.newCustomers),
        },
      ],
      result: moneyRatio(result.ultimateCac),
      note: "التكلفة الكاملة للبزنس لكل عميل جديد. هذا مقياس خاص بميزان Fully-loaded وليس CAC التقليدي.",
    },
    revenuePerPayingCustomer: {
      key: "revenuePerPayingCustomer",
      title: "الإيراد لكل عميل دافع",
      formula: "صافي الكاش المحصل ÷ إجمالي العملاء الدافعين",
      source: "مؤشر فترة من صافي التحصيل وعدد العملاء الدافعين داخل نفس الفترة.",
      lines: [
        {
          id: "revenue-paying-net-cash",
          label: "صافي الكاش المحصل",
          lineType: "subtotal",
          value: money(result.netCashCollected),
        },
        {
          id: "revenue-paying-count",
          label: "إجمالي العملاء الدافعين",
          lineType: "input",
          value: count(result.totalPayingCustomers),
        },
      ],
      result: moneyRatio(result.revenuePerPayingCustomer),
      note: "هذا مؤشر إيراد للفترة وليس LTV.",
    },
    revenuePerNewCustomer: {
      key: "revenuePerNewCustomer",
      title: "الإيراد لكل عميل جديد",
      formula: "صافي الكاش المحصل ÷ العملاء الجدد",
      source: "مؤشر فترة من صافي التحصيل وعدد العملاء الجدد داخل نفس الفترة.",
      lines: [
        {
          id: "revenue-new-net-cash",
          label: "صافي الكاش المحصل",
          lineType: "subtotal",
          value: money(result.netCashCollected),
        },
        {
          id: "revenue-new-count",
          label: "العملاء الجدد",
          lineType: "input",
          value: count(result.newCustomers),
        },
      ],
      result: moneyRatio(result.revenuePerNewCustomer),
      note: "هذا مؤشر إيراد للفترة وليس LTV.",
    },
    mer: {
      key: "mer",
      title: "MER",
      formula: "صافي الكاش المحصل ÷ إجمالي الإنفاق الإعلاني المعتمد",
      source: "صافي تحصيل البزنس الكامل مقابل الإنفاق الإعلاني الكانوني بعد المصالحة.",
      lines: [
        {
          id: "mer-net-cash",
          label: "صافي الكاش المحصل",
          lineType: "subtotal",
          value: money(result.netCashCollected),
        },
        {
          id: "mer-ad-spend",
          label: "إجمالي الإنفاق الإعلاني المعتمد",
          lineType: "input",
          value: money(canonicalAdSpend),
        },
      ],
      result: multipleRatio(result.mer),
    },
  };
}
