import type { CalculatedMetric, CoreCalculationResult, ExactRatio } from "./calculations.ts";
import {
  formatArabicExactDecimal,
  formatArabicExactPercent,
  formatArabicExactRatio,
} from "./format-exact.ts";

export type PayoffMetricKey = "netCashCollected" | "realNetProfit" | "realNetProfitMargin" | "ultimateCac";
export type PayoffMetricCard = {
  key: PayoffMetricKey;
  label: string;
  value: string;
  unavailable: boolean;
  explanation: string | null;
  description: string | null;
  negative: boolean;
};

const fallbackReasons: Record<string, string> = {
  INPUT_UNAVAILABLE: "البيانات اللازمة لحساب هذا المؤشر غير متاحة بعد.",
  NO_NEW_CUSTOMERS: "لا يمكن حساب التكلفة لكل عميل جديد لأن عدد العملاء الجدد صفر.",
  NO_PAYING_CUSTOMERS: "لا يمكن حساب المؤشر لأن عدد العملاء الدافعين صفر.",
  NON_POSITIVE_NET_CASH: "لا يمكن حساب هامش الربح لأن صافي التحصيل صفر أو أقل.",
  NO_AD_SPEND: "لا يمكن حساب المؤشر لعدم وجود إنفاق إعلاني.",
  ATTRIBUTION_UNAVAILABLE: "لا تتوفر بيانات إسناد مؤكدة لحساب هذا المؤشر.",
};

function reason<T>(metric: CalculatedMetric<T>, zeroReason?: string): string | null {
  if (metric.available) return null;
  return zeroReason ?? fallbackReasons[metric.reason] ?? fallbackReasons.INPUT_UNAVAILABLE;
}

function moneyCard(
  key: "netCashCollected" | "realNetProfit",
  label: string,
  metric: CalculatedMetric<string>,
  currency: string,
): PayoffMetricCard {
  return {
    key,
    label,
    value: metric.available ? `${formatArabicExactDecimal(metric.value)} ${currency}` : "—",
    unavailable: !metric.available,
    explanation: reason(metric),
    description: null,
    negative: metric.available && metric.value.startsWith("-") && !/^-(?:0+(?:\\.0+)?)$/.test(metric.value),
  };
}

/**
 * Formats the four existing canonical dashboard metrics; no financial calculations or
 * floating-point conversion occurs in this presentation model.
 */
export function buildSetupPayoffCards(
  financials: CoreCalculationResult,
  currency: string,
): readonly [PayoffMetricCard, PayoffMetricCard, PayoffMetricCard, PayoffMetricCard] {
  const margin = financials.realNetProfitMargin;
  const ultimate = financials.ultimateCac;
  return [
    moneyCard("netCashCollected", "صافي التحصيل", financials.netCashCollected, currency),
    moneyCard("realNetProfit", "صافي الربح الحقيقي", financials.realNetProfit, currency),
    {
      key: "realNetProfitMargin",
      label: "هامش صافي الربح الحقيقي",
      value: margin.available ? `${formatArabicExactPercent(margin.value)}٪` : "—",
      unavailable: !margin.available,
      explanation: reason(
        margin,
        !margin.available && margin.reason === "NON_POSITIVE_NET_CASH"
          ? "لا يمكن حساب هامش الربح لأن صافي التحصيل صفر."
          : undefined,
      ),
      description: null,
      negative: margin.available && BigInt(margin.value.numerator) < 0n,
    },
    {
      key: "ultimateCac",
      label: "التكلفة الكاملة للبزنس لكل عميل جديد",
      value: ultimate.available ? `${formatArabicExactRatio(ultimate.value)} ${currency}` : "—",
      unavailable: !ultimate.available,
      explanation: reason(ultimate),
      description: "مؤشر خاص بميزان يشمل كل تكاليف البزنس لكل عميل جديد، وليس تكلفة اكتساب العميل التقليدية.",
      negative: ultimate.available && BigInt(ultimate.value.numerator) < 0n,
    },
  ];
}
