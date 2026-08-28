import type { CalculationUnavailableReason, ExactRatio } from "@/lib/business/calculations";
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

const numberFormatter = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 });
const percentFormatter = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 1 });

function exactRatioNumber(ratio: ExactRatio) {
  const numerator = Number(ratio.numerator);
  const denominator = Number(ratio.denominator);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }
  return numerator / denominator;
}

function formatAuditValue(value: MetricAuditValue, currency: string) {
  if (!value.metric.available) return UNAVAILABLE_LABELS[value.metric.reason];

  if (value.kind === "money") {
    const numeric = Number(value.metric.value);
    return `${Number.isFinite(numeric) ? numberFormatter.format(numeric) : value.metric.value} ${currency}`;
  }

  if (value.kind === "count") {
    return numberFormatter.format(value.metric.value);
  }

  const numeric = exactRatioNumber(value.metric.value);
  if (numeric === null) {
    return `${value.metric.value.numerator}/${value.metric.value.denominator}`;
  }

  if (value.kind === "percent_ratio") return `${percentFormatter.format(numeric * 100)}%`;
  if (value.kind === "multiple_ratio") return `${numberFormatter.format(numeric)}×`;
  return `${numberFormatter.format(numeric)} ${currency}`;
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
