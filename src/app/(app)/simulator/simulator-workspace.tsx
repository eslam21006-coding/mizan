"use client";

import { useMemo, useState } from "react";
import type { ExactRatio } from "@/lib/business/calculations";
import { compareCurrentToScenario } from "@/lib/business/scenario-comparison";
import {
  SCENARIO_OVERRIDE_KEYS,
  ScenarioEngineInputError,
  type ScenarioEngineInput,
  type ScenarioMetric,
  type ScenarioOverrideKey,
  type ScenarioOverrides,
} from "@/lib/business/scenario-engine";
import {
  deleteSimulatorScenario,
  duplicateSimulatorScenario,
  saveSimulatorScenario,
} from "./actions";
import styles from "./simulator.module.css";

type SavedScenario = {
  id: string;
  name: string;
  creationRequestId: string;
  overrides: ScenarioOverrides;
};

type SimulatorWorkspaceProps = {
  businessId: string;
  month: string;
  currency: string;
  baseline: Omit<ScenarioEngineInput, "overrides">;
  selectedScenario: SavedScenario | null;
  newCreationRequestId: string;
  duplicateCreationRequestId: string;
  canManage: boolean;
};

type ControlDefinition = {
  key: ScenarioOverrideKey;
  label: string;
  note: string;
  kind: "money" | "rate";
  funnelDependent?: boolean;
};

const CONTROL_DEFINITIONS: readonly ControlDefinition[] = [
  {
    key: "customer_value",
    label: "قيمة العميل",
    note: "صافي الكاش المتوقع لكل عميل جديد في السيناريو. هذا ليس LTV.",
    kind: "money",
  },
  {
    key: "cpl",
    label: "تكلفة الليد (CPL)",
    note: "تُستخدم مع الإنفاق الإعلاني لتقدير عدد الليدز.",
    kind: "money",
    funnelDependent: true,
  },
  {
    key: "ad_spend",
    label: "الإنفاق الإعلاني",
    note: "يؤثر في حجم الفانل وفي التكاليف مرة واحدة فقط.",
    kind: "money",
  },
  {
    key: "show_rate",
    label: "نسبة الحضور",
    note: "نسبة الحضور من المكالمات المحجوزة.",
    kind: "rate",
    funnelDependent: true,
  },
  {
    key: "qualification_rate",
    label: "نسبة التأهيل",
    note: "نسبة المكالمات المؤهلة من المكالمات التي حضرت.",
    kind: "rate",
    funnelDependent: true,
  },
  {
    key: "close_rate",
    label: "نسبة الإغلاق",
    note: "نسبة المبيعات من المكالمات المؤهلة.",
    kind: "rate",
    funnelDependent: true,
  },
  {
    key: "fixed_costs",
    label: "التكاليف الثابتة غير الإعلانية",
    note: "التكاليف الشهرية الثابتة بعد فصل الإنفاق الإعلاني والتكاليف المتغيرة.",
    kind: "money",
  },
  {
    key: "variable_costs",
    label: "التكلفة المتغيرة لكل عميل جديد",
    note: "قيمة فعالة لكل عميل جديد مبنية على التكاليف المتغيرة الحالية.",
    kind: "money",
  },
  {
    key: "upsells",
    label: "إيراد إضافي من Upsells",
    note: "صافي إيراد إضافي شهري في السيناريو.",
    kind: "money",
  },
  {
    key: "renewals",
    label: "إيراد إضافي من التجديدات",
    note: "صافي إيراد إضافي شهري من التجديدات.",
    kind: "money",
  },
  {
    key: "backend_revenue",
    label: "إيراد إضافي من Backend",
    note: "صافي إيراد إضافي شهري من عروض الـ Backend.",
    kind: "money",
  },
];

const numberFormatter = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 });
const percentFormatter = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 1 });

function normalizeLocalizedDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/٬/g, "")
    .replace(/٫/g, ".");
}

function ratioNumber(value: ExactRatio) {
  const numerator = Number(value.numerator);
  const denominator = Number(value.denominator);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

function ratioInput(value: ExactRatio, rate = false) {
  const number = ratioNumber(value);
  if (number === null) return `${value.numerator}/${value.denominator}`;
  const adjusted = rate ? number * 100 : number;
  return adjusted
    .toFixed(8)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

function rateOverrideToPercent(value: string) {
  if (!/^\d+(?:\.\d+)?$/.test(value)) return value;
  const [whole, fraction = ""] = value.split(".");
  const coefficient = BigInt(`${whole}${fraction}` || "0") * 100n;
  const scale = fraction.length;
  if (scale === 0) return coefficient.toString();
  const digits = coefficient.toString().padStart(scale + 1, "0");
  const splitAt = digits.length - scale;
  return `${digits.slice(0, splitAt)}.${digits.slice(splitAt)}`
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

function percentToRateOverride(value: string) {
  const raw = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return raw;
  const [whole, fraction = ""] = raw.split(".");
  const coefficient = BigInt(`${whole}${fraction}` || "0");
  const scale = fraction.length + 2;
  const digits = coefficient.toString().padStart(scale + 1, "0");
  const splitAt = digits.length - scale;
  return `${digits.slice(0, splitAt)}.${digits.slice(splitAt)}`
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

function formatMoney(value: ExactRatio, currency: string) {
  const number = ratioNumber(value);
  return number === null
    ? `${value.numerator}/${value.denominator} ${currency}`
    : `${numberFormatter.format(number)} ${currency}`;
}

function formatPercent(value: ExactRatio) {
  const number = ratioNumber(value);
  return number === null
    ? `${value.numerator}/${value.denominator}`
    : `${percentFormatter.format(number * 100)}%`;
}

function formatDelta(value: ExactRatio, kind: "money" | "percent", currency: string) {
  const number = ratioNumber(value);
  if (number === null) return `${value.numerator}/${value.denominator}`;
  const sign = number > 0 ? "+" : "";
  return kind === "percent"
    ? `${sign}${percentFormatter.format(number * 100)} نقطة`
    : `${sign}${numberFormatter.format(number)} ${currency}`;
}

function formatMetric(
  metric: ScenarioMetric<ExactRatio>,
  kind: "money" | "percent",
  currency: string,
) {
  if (!metric.available) return "غير متاح";
  return kind === "percent" ? formatPercent(metric.value) : formatMoney(metric.value, currency);
}

function ComparisonRow({
  label,
  current,
  scenario,
  delta,
}: {
  label: string;
  current: string;
  scenario: string;
  delta: string;
}) {
  return (
    <div className={styles.comparisonRow}>
      <strong>{label}</strong>
      <span>{current}</span>
      <span>{scenario}</span>
      <span>{delta}</span>
    </div>
  );
}

export function SimulatorWorkspace({
  businessId,
  month,
  currency,
  baseline,
  selectedScenario,
  newCreationRequestId,
  duplicateCreationRequestId,
  canManage,
}: SimulatorWorkspaceProps) {
  const [scenarioName, setScenarioName] = useState(selectedScenario?.name ?? "سيناريو جديد");
  const [overrides, setOverrides] = useState<ScenarioOverrides>(selectedScenario?.overrides ?? {});

  const calculation = useMemo(() => {
    try {
      return {
        comparison: compareCurrentToScenario({ ...baseline, overrides }),
        error: null as string | null,
      };
    } catch (error) {
      return {
        comparison: null,
        error:
          error instanceof ScenarioEngineInputError
            ? "لا يمكن حساب السيناريو بهذه القيم. راجع الحقول المعدلة."
            : "تعذر حساب السيناريو.",
      };
    }
  }, [baseline, overrides]);

  const baselineResult = useMemo(
    () => compareCurrentToScenario({ ...baseline, overrides: {} }),
    [baseline],
  );
  const funnelAvailable = baselineResult.current.funnel.available;

  function setOverride(key: ScenarioOverrideKey, value: string) {
    setOverrides((current) => ({ ...current, [key]: value }));
  }

  function resetOverride(key: ScenarioOverrideKey) {
    setOverrides((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  const overridesJson = JSON.stringify(overrides);
  const selectedCreationRequestId = selectedScenario?.creationRequestId ?? newCreationRequestId;

  return (
    <div className={styles.workspace}>
      <section className={styles.controlPanel}>
        <div className={styles.sectionHeading}>
          <div>
            <span>Task 33</span>
            <h2>عدّل السيناريو</h2>
          </div>
          <p>أي تعديل هنا افتراضي فقط. الأرقام التاريخية الفعلية لا تتغير.</p>
        </div>

        {!funnelAvailable && (
          <div className={styles.notice} role="status">
            بيانات الفانل لهذا الشهر غير مكتملة بما يكفي للتنبؤ بعدد عملاء جديد. لذلك يظل عدد
            العملاء الفعلي ثابتًا، وتُعطّل إعدادات CPL ونسب الفانل بدل تخمين قيم غير موجودة.
          </div>
        )}

        <div className={styles.controlsGrid}>
          {CONTROL_DEFINITIONS.map((definition) => {
            const baselineControl = baselineResult.current.controls[definition.key];
            const override = overrides[definition.key];
            const disabled = Boolean(definition.funnelDependent && !funnelAvailable);
            const value =
              override !== undefined
                ? definition.kind === "rate"
                  ? rateOverrideToPercent(override)
                  : override
                : ratioInput(baselineControl.value, definition.kind === "rate");

            return (
              <label className={disabled ? styles.controlDisabled : styles.control} key={definition.key}>
                <div className={styles.controlTitle}>
                  <span>{definition.label}</span>
                  {override !== undefined && !disabled && (
                    <button type="button" onClick={() => resetOverride(definition.key)}>
                      العودة للقيمة الحالية
                    </button>
                  )}
                </div>
                <div className={styles.inputWrap}>
                  <input
                    dir="ltr"
                    inputMode="decimal"
                    value={value}
                    disabled={disabled}
                    aria-label={definition.label}
                    onChange={(event) => {
                      const normalized = normalizeLocalizedDigits(event.target.value);
                      setOverride(
                        definition.key,
                        definition.kind === "rate"
                          ? percentToRateOverride(normalized)
                          : normalized,
                      );
                    }}
                  />
                  <span>{definition.kind === "rate" ? "%" : currency}</span>
                </div>
                <small>{definition.note}</small>
              </label>
            );
          })}
        </div>

        {calculation.error && (
          <div className={styles.errorPanel} role="alert">
            {calculation.error}
          </div>
        )}

        <div className={styles.savePanel}>
          <label>
            <span>اسم السيناريو</span>
            <input
              value={scenarioName}
              maxLength={120}
              disabled={!canManage}
              onChange={(event) => setScenarioName(event.target.value)}
            />
          </label>

          {canManage ? (
            <div className={styles.saveActions}>
              <form action={saveSimulatorScenario}>
                <input type="hidden" name="business_id" value={businessId} />
                <input type="hidden" name="month" value={month} />
                <input type="hidden" name="scenario_id" value={selectedScenario?.id ?? ""} />
                <input
                  type="hidden"
                  name="creation_request_id"
                  value={selectedCreationRequestId}
                />
                <input type="hidden" name="name" value={scenarioName} />
                <input type="hidden" name="overrides_json" value={overridesJson} />
                <button type="submit" disabled={!calculation.comparison}>
                  {selectedScenario ? "حفظ التعديلات" : "حفظ السيناريو"}
                </button>
              </form>

              {selectedScenario && (
                <>
                  <form action={duplicateSimulatorScenario}>
                    <input type="hidden" name="business_id" value={businessId} />
                    <input type="hidden" name="month" value={month} />
                    <input type="hidden" name="scenario_id" value={selectedScenario.id} />
                    <input
                      type="hidden"
                      name="creation_request_id"
                      value={duplicateCreationRequestId}
                    />
                    <input type="hidden" name="name" value={`${scenarioName} - نسخة`} />
                    <button type="submit" className={styles.secondaryButton}>
                      إنشاء نسخة
                    </button>
                  </form>
                  <form action={deleteSimulatorScenario}>
                    <input type="hidden" name="business_id" value={businessId} />
                    <input type="hidden" name="month" value={month} />
                    <input type="hidden" name="scenario_id" value={selectedScenario.id} />
                    <button type="submit" className={styles.dangerButton}>
                      حذف السيناريو
                    </button>
                  </form>
                </>
              )}
            </div>
          ) : (
            <p className={styles.readOnlyNote}>لديك صلاحية عرض السيناريوهات فقط.</p>
          )}
        </div>
      </section>

      {calculation.comparison && (
        <>
          <section className={styles.comparisonPanel}>
            <div className={styles.sectionHeading}>
              <div>
                <span>Task 34</span>
                <h2>الحالي مقابل السيناريو</h2>
              </div>
              <p>الحالي هو الشهر المحفوظ كما هو. السيناريو يعرض أثر التعديلات فقط.</p>
            </div>

            <div className={styles.comparisonHeader} aria-hidden="true">
              <strong>المؤشر</strong>
              <span>الحالي</span>
              <span>السيناريو</span>
              <span>التغير</span>
            </div>

            <div className={styles.comparisonTable}>
              <ComparisonRow
                label="صافي الكاش المحصل"
                current={formatMoney(
                  calculation.comparison.financial.netCashCollected.current,
                  currency,
                )}
                scenario={formatMoney(
                  calculation.comparison.financial.netCashCollected.scenario,
                  currency,
                )}
                delta={formatDelta(
                  calculation.comparison.financial.netCashCollected.delta,
                  "money",
                  currency,
                )}
              />
              <ComparisonRow
                label="العملاء الجدد"
                current={numberFormatter.format(
                  calculation.comparison.financial.newCustomers.current,
                )}
                scenario={numberFormatter.format(
                  calculation.comparison.financial.newCustomers.scenario,
                )}
                delta={`${calculation.comparison.financial.newCustomers.delta > 0 ? "+" : ""}${numberFormatter.format(calculation.comparison.financial.newCustomers.delta)}`}
              />
              <ComparisonRow
                label="صافي الربح الحقيقي"
                current={formatMoney(
                  calculation.comparison.financial.realNetProfit.current,
                  currency,
                )}
                scenario={formatMoney(
                  calculation.comparison.financial.realNetProfit.scenario,
                  currency,
                )}
                delta={formatDelta(
                  calculation.comparison.financial.realNetProfit.delta,
                  "money",
                  currency,
                )}
              />
              <ComparisonRow
                label="هامش صافي الربح الحقيقي"
                current={formatMetric(
                  calculation.comparison.financial.realNetProfitMargin.current,
                  "percent",
                  currency,
                )}
                scenario={formatMetric(
                  calculation.comparison.financial.realNetProfitMargin.scenario,
                  "percent",
                  currency,
                )}
                delta={formatMetric(
                  calculation.comparison.financial.realNetProfitMargin.delta,
                  "percent",
                  currency,
                )}
              />
              <ComparisonRow
                label="Ultimate CAC — التكلفة الكاملة للبزنس لكل عميل جديد"
                current={formatMetric(
                  calculation.comparison.financial.ultimateCac.current,
                  "money",
                  currency,
                )}
                scenario={formatMetric(
                  calculation.comparison.financial.ultimateCac.scenario,
                  "money",
                  currency,
                )}
                delta={formatMetric(
                  calculation.comparison.financial.ultimateCac.delta,
                  "money",
                  currency,
                )}
              />
              <ComparisonRow
                label="الإنفاق الإعلاني"
                current={formatMoney(calculation.comparison.financial.adSpend.current, currency)}
                scenario={formatMoney(calculation.comparison.financial.adSpend.scenario, currency)}
                delta={formatDelta(
                  calculation.comparison.financial.adSpend.delta,
                  "money",
                  currency,
                )}
              />
              <ComparisonRow
                label="CPL"
                current={formatMetric(
                  calculation.comparison.financial.cpl.current,
                  "money",
                  currency,
                )}
                scenario={formatMetric(
                  calculation.comparison.financial.cpl.scenario,
                  "money",
                  currency,
                )}
                delta={formatMetric(
                  calculation.comparison.financial.cpl.delta,
                  "money",
                  currency,
                )}
              />
            </div>
          </section>

          <section className={styles.funnelPanel}>
            <div className={styles.sectionHeading}>
              <div>
                <span>مسار الفانل</span>
                <h2>الأحجام التشغيلية</h2>
              </div>
              <p>
                نسبة الحجز ونسبة تحوّل المبيعات إلى عملاء تظلان مثبتتين على الأداء الفعلي لهذا
                الشهر، لأنهما ليستا من تحكمات المحاكي الحالية.
              </p>
            </div>

            {calculation.comparison.funnel.available ? (
              <div className={styles.funnelGrid}>
                {([
                  ["الليدز", calculation.comparison.funnel.leads],
                  ["المكالمات المحجوزة", calculation.comparison.funnel.bookedCalls],
                  ["الحضور", calculation.comparison.funnel.showedCalls],
                  ["المكالمات المؤهلة", calculation.comparison.funnel.qualifiedCalls],
                  ["المبيعات", calculation.comparison.funnel.sales],
                  ["العملاء الجدد", calculation.comparison.funnel.newCustomers],
                ] as const).map(([label, values]) => (
                  <article key={label}>
                    <span>{label}</span>
                    <strong>{numberFormatter.format(values.scenario)}</strong>
                    <small>
                      الحالي {numberFormatter.format(values.current)} · التغير{" "}
                      {values.delta > 0 ? "+" : ""}
                      {numberFormatter.format(values.delta)}
                    </small>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.notice}>
                لا توجد بيانات فعلية مكتملة بما يكفي لعرض مقارنة أحجام الفانل. لم يتم اختراع نسب
                بديلة.
              </div>
            )}
          </section>
        </>
      )}

      <p className={styles.historyBoundary}>
        السيناريو منفصل عن التاريخ: الحفظ والتعديل والحذف يعمل فقط على جداول السيناريوهات ولا يغير
        أي شهر فعلي محفوظ.
      </p>
    </div>
  );
}
