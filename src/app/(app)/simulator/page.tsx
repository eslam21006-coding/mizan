import { randomUUID } from "node:crypto";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { requireAuthContext } from "@/lib/auth/context";
import { currentMonthKeyForTimeZone, parseMonthKey } from "@/lib/business/monthly";
import {
  SCENARIO_OVERRIDE_KEYS,
  type ScenarioOverrideKey,
  type ScenarioOverrides,
} from "@/lib/business/scenario-engine";
import { loadSimulatorMonth, type SimulatorMonthBlocker } from "@/lib/business/simulator-month";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "./simulator.module.css";
import { SimulatorWorkspace } from "./simulator-workspace";

type SimulatorPageProps = {
  searchParams: Promise<{
    business?: string;
    month?: string;
    scenario?: string;
    status?: string;
  }>;
};

type BusinessRow = {
  id: string;
  name: string;
  base_currency: string;
  timezone: string;
  owner_user_id: string;
};

type ScenarioRow = {
  id: string;
  name: string;
  creation_request_id: string;
  updated_at: string;
};

type OverrideRow = {
  scenario_id: string;
  override_key: string;
  override_value: string | number;
};

const BLOCKER_COPY: Record<SimulatorMonthBlocker, string> = {
  MONTH_NOT_SAVED: "لا توجد أرقام فعلية محفوظة لهذا الشهر بعد.",
  MONTH_DATA_UNAVAILABLE: "تعذر تحميل بيانات الشهر كاملة، لذلك لن يبني المحاكي أرقامًا على بيانات ناقصة.",
  MONTH_CALCULATION_INVALID: "بيانات الشهر تحتوي على تعارض يمنع إعادة استخدامها بأمان في المحاكي.",
  NET_CASH_UNAVAILABLE: "صافي الكاش المحصل غير متاح لهذا الشهر.",
  COSTS_UNAVAILABLE: "إجمالي تكاليف البزنس غير متاح لهذا الشهر.",
  VARIABLE_COSTS_UNAVAILABLE: "التكاليف المتغيرة غير متاحة لهذا الشهر.",
  NEW_CUSTOMERS_UNAVAILABLE: "عدد العملاء الجدد غير متاح لهذا الشهر.",
  NO_NEW_CUSTOMERS: "لا يوجد عملاء جدد في الشهر الحالي، لذلك لا يمكن اشتقاق قيمة عميل أو تكلفة متغيرة لكل عميل دون تخمين.",
  AD_SPEND_UNAVAILABLE: "الإنفاق الإعلاني الفعلي غير متاح أو غير متصالح لهذا الشهر. احفظ إنفاقًا إعلانيًا واضحًا أولًا.",
};

const STATUS_COPY: Record<string, string> = {
  saved: "تم حفظ السيناريو.",
  updated: "تم حفظ تعديلات السيناريو.",
  duplicated: "تم إنشاء نسخة من السيناريو.",
  deleted: "تم حذف السيناريو.",
  invalid: "تعذر تنفيذ العملية لأن إحدى القيم غير صالحة.",
  "save-failed": "تعذر حفظ السيناريو.",
  "duplicate-failed": "تعذر إنشاء نسخة من السيناريو.",
  "delete-failed": "تعذر حذف السيناريو.",
};

function isScenarioOverrideKey(value: string): value is ScenarioOverrideKey {
  return SCENARIO_OVERRIDE_KEYS.includes(value as ScenarioOverrideKey);
}

export default async function SimulatorPage({ searchParams }: SimulatorPageProps) {
  const query = await searchParams;
  const auth = await requireAuthContext();
  const supabase = await createSupabaseServerClient();

  const { data: businessesData, error: businessesError } = await supabase
    .from("businesses")
    .select("id,name,base_currency,timezone,owner_user_id")
    .order("created_at", { ascending: false });

  const businesses = (businessesData ?? []) as BusinessRow[];

  if (businessesError) {
    return (
      <div className="page-stack">
        <PageHeading title="المحاكي" description="اختبر أثر القرارات قبل تطبيقها على البزنس." />
        <section className={styles.insufficientPanel} role="alert">
          <h2>تعذر تحميل البزنسات</h2>
          <p>لم يتم عرض أي سيناريو حتى لا نعتمد على بيانات غير مؤكدة.</p>
        </section>
      </div>
    );
  }

  if (businesses.length === 0) {
    return (
      <div className="page-stack">
        <PageHeading title="المحاكي" description="اختبر أثر القرارات قبل تطبيقها على البزنس." />
        <section className={styles.insufficientPanel}>
          <h2>أضف بزنس أولًا</h2>
          <p>المحاكي يحتاج إلى شهر فعلي محفوظ ليستخدمه كنقطة بداية.</p>
          <Link href="/businesses/new">إعداد أول بزنس</Link>
        </section>
      </div>
    );
  }

  const selectedBusiness =
    businesses.find((business) => business.id === query.business) ?? businesses[0];
  const fallbackMonth = currentMonthKeyForTimeZone(selectedBusiness.timezone);
  const selectedMonth = parseMonthKey(query.month) ?? parseMonthKey(fallbackMonth);
  if (!selectedMonth) throw new Error("Could not resolve a valid simulator month.");

  const [{ data: scenariosData, error: scenariosError }, simulatorMonth] = await Promise.all([
    supabase
      .from("simulator_scenarios")
      .select("id,name,creation_request_id,updated_at")
      .eq("business_id", selectedBusiness.id)
      .order("updated_at", { ascending: false }),
    loadSimulatorMonth(supabase, selectedBusiness.id, selectedMonth.monthStart),
  ]);

  const scenarios = (scenariosData ?? []) as ScenarioRow[];
  const scenarioIds = scenarios.map((scenario) => scenario.id);
  const { data: overridesData, error: overridesError } =
    scenarioIds.length === 0
      ? { data: [] as OverrideRow[], error: null }
      : await supabase
          .from("simulator_scenario_overrides")
          .select("scenario_id,override_key,override_value")
          .eq("business_id", selectedBusiness.id)
          .in("scenario_id", scenarioIds);

  const scenarioDataError = Boolean(scenariosError || overridesError);
  const overridesByScenario = new Map<string, ScenarioOverrides>();
  for (const row of (overridesData ?? []) as OverrideRow[]) {
    if (!isScenarioOverrideKey(row.override_key)) continue;
    const current = overridesByScenario.get(row.scenario_id) ?? {};
    current[row.override_key] = String(row.override_value);
    overridesByScenario.set(row.scenario_id, current);
  }

  const selectedScenarioRow = scenarios.find((scenario) => scenario.id === query.scenario) ?? null;
  const selectedScenario = selectedScenarioRow
    ? {
        id: selectedScenarioRow.id,
        name: selectedScenarioRow.name,
        creationRequestId: selectedScenarioRow.creation_request_id,
        overrides: overridesByScenario.get(selectedScenarioRow.id) ?? {},
      }
    : null;
  const canManage = auth.role === "admin" || selectedBusiness.owner_user_id === auth.userId;
  const statusCopy = query.status ? STATUS_COPY[query.status] : null;

  return (
    <div className="page-stack">
      <div className={styles.pageHeader}>
        <PageHeading
          title="المحاكي"
          description="غيّر الافتراضات وشاهد أثرها فورًا بدون تعديل أي بيانات تاريخية فعلية."
        />
        <div className={styles.headerActions}>
          <Link href={`/?business=${selectedBusiness.id}&month=${selectedMonth.monthKey}`}>
            فتح الداشبورد الحالي
          </Link>
          <Link href={`/simulator?business=${selectedBusiness.id}&month=${selectedMonth.monthKey}`}>
            سيناريو جديد
          </Link>
        </div>
      </div>

      <section className={styles.selectorPanel} aria-label="اختيار البزنس والشهر والسيناريو">
        <form>
          <input type="hidden" name="month" value={selectedMonth.monthKey} />
          <label>
            <span>البزنس</span>
            <select name="business" defaultValue={selectedBusiness.id}>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name} — {business.base_currency}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">فتح البزنس</button>
        </form>

        <form>
          <input type="hidden" name="business" value={selectedBusiness.id} />
          <label>
            <span>الشهر الفعلي المرجعي</span>
            <input dir="ltr" type="month" name="month" defaultValue={selectedMonth.monthKey} />
          </label>
          <button type="submit">فتح الشهر</button>
        </form>

        <form>
          <input type="hidden" name="business" value={selectedBusiness.id} />
          <input type="hidden" name="month" value={selectedMonth.monthKey} />
          <label>
            <span>السيناريو المحفوظ</span>
            <select name="scenario" defaultValue={selectedScenario?.id ?? ""}>
              <option value="">سيناريو جديد غير محفوظ</option>
              {scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">فتح السيناريو</button>
        </form>
      </section>

      {statusCopy && <div className={styles.statusPanel}>{statusCopy}</div>}

      {scenarioDataError && (
        <section className={styles.insufficientPanel} role="alert">
          <h2>تعذر تحميل السيناريوهات المحفوظة</h2>
          <p>يمكن مراجعة البيانات الفعلية، لكن الحفظ أو فتح سيناريو موجود لن يُعرض على أنه ناجح.</p>
        </section>
      )}

      {simulatorMonth.status === "insufficient" ? (
        <section className={styles.insufficientPanel}>
          <h2>لا توجد نقطة بداية كافية للمحاكي</h2>
          <p>{BLOCKER_COPY[simulatorMonth.blocker]}</p>
          <div className={styles.headerActions}>
            <Link
              href={`/businesses/${selectedBusiness.id}/monthly?month=${selectedMonth.monthKey}`}
            >
              مراجعة أرقام الشهر
            </Link>
            <Link
              href={`/businesses/${selectedBusiness.id}/funnels/monthly?month=${selectedMonth.monthKey}`}
            >
              مراجعة الإنفاق والفانلز
            </Link>
          </div>
        </section>
      ) : (
        <SimulatorWorkspace
          businessId={selectedBusiness.id}
          month={selectedMonth.monthKey}
          currency={selectedBusiness.base_currency}
          baseline={simulatorMonth.input}
          selectedScenario={selectedScenario}
          newCreationRequestId={randomUUID()}
          duplicateCreationRequestId={randomUUID()}
          canManage={canManage && !scenarioDataError}
        />
      )}
    </div>
  );
}
