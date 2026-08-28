import type { CalculationUnavailableReason } from "@/lib/business/calculations";
import {
  formatArabicExactDecimal,
  formatArabicExactPercent,
  formatArabicExactRatio,
} from "@/lib/business/format-exact";
import type { MetricAudit, MetricAuditValue } from "@/lib/business/metric-audit";
import styles from "./metric-audit.module.css";

const UNAVAILABLE_LABELS: Record<CalculationUnavailableReason, string> = {
  INPUT_UNAVAILABLE: "بيانات غير مكتملة",
  NO_NEW_CUSTOMERS: "لا يوجد عملاء جدد",
  NO_PAYING_CUSTOMERS: "لا يوجد عملاء دافعون",
  NON_POSITIVE_NET_CASH: "صافي التحصيل غير موجب",
  NO_AD_SPEND: "لا يوجد إنفاق إعلاني",
  ATTRIBUTION_UNAVAILABLE: "بيانات الإسناد غير متاحة",
};

const countFormatter = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 });

function formatAuditValue(value: MetricAuditValue, currency: string) {
  if (!value.metric.available) return UNAVAILABLE_LABELS[value.metric.reason];

  if (value.kind === "money") {
    return `${formatArabicExactDecimal(value.metric.value, 2)} ${currency}`;
  }

  if (value.kind === "count") {
    return countFormatter.format(value.metric.value);
  }

  if (value.kind === "percent_ratio") {
    return `${formatArabicExactPercent(value.metric.value, 1)}%`;
  }

  if (value.kind === "multiple_ratio") {
    return `${formatArabicExactRatio(value.metric.value, 2)}×`;
  }

  return `${formatArabicExactRatio(value.metric.value, 2)} ${currency}`;
}

/** Renders a progressively disclosed, read-only explanation of one calculated metric. */
export function MetricAuditDetails({
  audit,
  currency,
  compact = false,
}: {
  audit: MetricAudit;
  currency: string;
  compact?: boolean;
}) {
  return (
    <details className={`${styles.audit} ${compact ? styles.compact : ""}`}>
      <summary>الرقم ده جاي منين؟</summary>
      <div className={styles.body}>
        <div className={styles.heading}>
          <div>
            <span>تفاصيل الحساب</span>
            <strong>{audit.title}</strong>
          </div>
          <code dir="rtl">{audit.formula}</code>
        </div>

        <div className={styles.lines}>
          {audit.lines.map((line) => (
            <div
              key={line.id}
              className={line.lineType === "subtotal" ? styles.subtotal : undefined}
            >
              <span>{line.label}</span>
              <strong>{formatAuditValue(line.value, currency)}</strong>
            </div>
          ))}
          <div className={styles.resultRow}>
            <span>النتيجة</span>
            <strong>{formatAuditValue(audit.result, currency)}</strong>
          </div>
        </div>

        <p className={styles.source}>
          <strong>المصدر:</strong> {audit.source}
        </p>
        {audit.note && <p className={styles.note}>{audit.note}</p>}
      </div>
    </details>
  );
}
