import Link from "next/link";
import { createRevenueStream } from "../revenue-streams/actions";
import { BusinessContext } from "@/components/business-context";
import {
  BUSINESS_SETUP_STEPS,
  buildBusinessSetupHref,
  type BusinessSetupStep,
} from "@/lib/business/setup-navigation";
import type { BusinessSetupReadiness } from "@/lib/business/setup-readiness";
import type {
  ExpenseCategoryCounts,
  ExpenseCreationRequestIds,
  SetupExpenseItem,
} from "@/lib/business/expenses";
import type { SetupRevenueSource } from "@/lib/business/setup-loader";
import { ExpenseSetupContent } from "./expense-setup-content";
import type { FirstMonthSetupResult } from "@/lib/business/first-month-setup";
import { FirstMonthSetupContent } from "./first-month-setup-content";
import type { FirstMonthSaveState } from "./first-month-actions";
import type { FirstMonthPostSaveStatus } from "@/lib/business/first-month-post-save";
import styles from "./business-setup-shell.module.css";

const STEP_LABELS: Readonly<Record<BusinessSetupStep, string>> = {
  business: "عن البزنس",
  revenue: "كيف يدخل المال؟",
  expenses: "أين يذهب المال؟",
  month: "أول شهر حقيقي",
};

type BusinessSetupShellProps = {
  businessId: string;
  businessName: string;
  baseCurrency: string;
  timezone: string;
  currentStep: BusinessSetupStep | null;
  readiness: BusinessSetupReadiness;
  canManage: boolean;
  revenueSourceCount: number | null;
  revenueSources: SetupRevenueSource[] | null;
  revenueCreationRequestId: string | null;
  revenueStatus: string | null;
  expenseItems: SetupExpenseItem[] | null;
  activeExpenseCategoryCounts: ExpenseCategoryCounts | null;
  expenseCreationRequestIds: ExpenseCreationRequestIds | null;
  expenseStatus: string | null;
  latestSavedMonthKey: string | null;
  firstMonth: FirstMonthSetupResult | null;
  monthSaved?: boolean;
  postSaveStatus?: FirstMonthPostSaveStatus | null;
  firstMonthSaveSeed?: FirstMonthSaveState;
  invalidMonth?: boolean;
  backHref: string | null;
  nextHref: string | null;
  nextLabel: string;
  nextEnabled: boolean;
  loadError?: boolean;
};

/** Renders the focused four-step setup surface without exposing the full business workspace tabs. */
export function BusinessSetupShell({
  businessId,
  businessName,
  baseCurrency,
  timezone,
  currentStep,
  readiness,
  canManage,
  revenueSourceCount,
  revenueSources,
  revenueCreationRequestId,
  revenueStatus,
  expenseItems,
  activeExpenseCategoryCounts,
  expenseCreationRequestIds,
  expenseStatus,
  latestSavedMonthKey,
  firstMonth,
  monthSaved = false,
  postSaveStatus = null,
  firstMonthSaveSeed,
  invalidMonth = false,
  backHref,
  nextHref,
  nextLabel,
  nextEnabled,
  loadError = false,
}: BusinessSetupShellProps) {
  const completedCount = readiness.completedStepCount;
  const setupComplete =
    !loadError && readiness.coreSetup.loadState === "loaded" && readiness.coreSetup.status === "ready";

  return (
    <div className={styles.setupPage}>
      <BusinessContext
        businessName={businessName}
        baseCurrency={baseCurrency}
        timezone={timezone}
      />

      <section className={styles.shell} aria-labelledby="business-setup-title">
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <span className={styles.kicker}>إعداد البزنس</span>
            <h1 id="business-setup-title">
              {setupComplete && currentStep === null ? "إعداد البزنس مكتمل" : "أكمل إعداد البزنس"}
            </h1>
            <p>
              {loadError
                ? "تعذر تحميل حالة الإعداد الآن. لم نفترض أن أي خطوة ناقصة أو مكتملة."
                : setupComplete && currentStep === null
                  ? "الأساسيات الأربع جاهزة ويمكنك الرجوع لأي خطوة لمراجعتها."
                  : "أكمل الأساسيات بالترتيب الذي يناسبك. ميزان يحسب التقدم من بيانات البزنس الفعلية."}
            </p>
          </div>

          <div className={styles.progressBlock} aria-live="polite">
            {loadError || completedCount === null ? (
              <strong className={styles.progressUnknown}>حالة التقدم غير متاحة</strong>
            ) : (
              <>
                <strong className={styles.progressCount}>{completedCount} من 4 خطوات مكتملة</strong>
                <div
                  className={styles.progressTrack}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={4}
                  aria-valuenow={completedCount}
                  aria-label="تقدم إعداد البزنس"
                >
                  <span
                    className={styles.progressValue}
                    style={{ inlineSize: `${(completedCount / 4) * 100}%` }}
                  />
                </div>
              </>
            )}
            {!canManage && <span className={styles.readOnlyBadge}>عرض فقط</span>}
          </div>
        </header>

        <ol className={styles.stepper} aria-label="خطوات إعداد البزنس">
          {BUSINESS_SETUP_STEPS.map((step, index) => {
            const isCurrent = currentStep === step;
            const isComplete = readiness.stepComplete[step];
            const className = [
              styles.step,
              isCurrent ? styles.currentStep : "",
              isComplete ? styles.completeStep : "",
            ]
              .filter(Boolean)
              .join(" ");
            const content = (
              <>
                <span className={styles.stepNumber} aria-hidden="true">
                  {isComplete ? "✓" : index + 1}
                </span>
                <span className={styles.stepLabel}>{STEP_LABELS[step]}</span>
                <span className={styles.stepState}>
                  {loadError
                    ? "غير متاحة"
                    : isComplete
                      ? "مكتملة"
                      : isCurrent
                        ? "الحالية"
                        : "غير مكتملة"}
                </span>
              </>
            );

            return (
              <li key={step} className={className}>
                {loadError ? (
                  <span className={styles.stepLink} aria-current={isCurrent ? "step" : undefined}>
                    {content}
                  </span>
                ) : (
                  <Link
                    className={styles.stepLink}
                    href={buildBusinessSetupHref(businessId, step)}
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>

        {loadError ? (
          <section className={styles.errorPanel} role="alert">
            <strong>تعذر تحميل حالة إعداد البزنس</strong>
            <p>أعد تحميل الصفحة. لن يعتبر ميزان البيانات المفقودة صفرًا ولن يحدد خطوة متابعة حتى تنجح القراءة.</p>
          </section>
        ) : setupComplete && currentStep === null ? (
          <section className={styles.completionPanel}>
            <span className={styles.statusBadge}>4 / 4</span>
            <h2>الأساسيات جاهزة</h2>
            <p>يمكنك فتح البزنس الآن أو الرجوع إلى خطوة الشهر لمراجعة حالة الإعداد.</p>
            <div className={styles.completionActions}>
              <Link className={styles.primaryAction} href={`/businesses/${encodeURIComponent(businessId)}`}>
                فتح البزنس
              </Link>
              <Link
                className={styles.secondaryAction}
                href={buildBusinessSetupHref(businessId, "month")}
              >
                مراجعة أول شهر
              </Link>
            </div>
          </section>
        ) : currentStep ? (
          <section className={styles.stepPanel} aria-labelledby={`setup-step-${currentStep}`}>
            <StepContent
              step={currentStep}
              businessName={businessName}
              baseCurrency={baseCurrency}
              timezone={timezone}
              stepComplete={readiness.stepComplete[currentStep]}
              revenueSourceCount={revenueSourceCount}
              revenueSources={revenueSources}
              revenueCreationRequestId={revenueCreationRequestId}
              revenueStatus={revenueStatus}
              expenseItems={expenseItems}
              activeExpenseCategoryCounts={activeExpenseCategoryCounts}
              expenseCreationRequestIds={expenseCreationRequestIds}
              expenseStatus={expenseStatus}
              businessId={businessId}
              canManage={canManage}
              latestSavedMonthKey={latestSavedMonthKey}
              firstMonth={firstMonth}
              monthSaved={monthSaved}
              postSaveStatus={postSaveStatus}
              firstMonthSaveSeed={firstMonthSaveSeed}
              invalidMonth={invalidMonth}
            />
          </section>
        ) : null}

        {!loadError && currentStep && (
          <nav className={styles.actions} aria-label="التنقل بين خطوات الإعداد">
            {backHref ? (
              <Link className={styles.secondaryAction} href={backHref}>
                السابق
              </Link>
            ) : (
              <span />
            )}

            {nextEnabled && nextHref ? (
              <Link className={styles.primaryAction} href={nextHref}>
                {nextLabel}
              </Link>
            ) : (
              <button className={styles.disabledAction} type="button" disabled>
                {nextLabel}
              </button>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}

type StepContentProps = {
  step: BusinessSetupStep;
  businessName: string;
  baseCurrency: string;
  timezone: string;
  stepComplete: boolean;
  revenueSourceCount: number | null;
  revenueSources: SetupRevenueSource[] | null;
  revenueCreationRequestId: string | null;
  revenueStatus: string | null;
  expenseItems: SetupExpenseItem[] | null;
  activeExpenseCategoryCounts: ExpenseCategoryCounts | null;
  expenseCreationRequestIds: ExpenseCreationRequestIds | null;
  expenseStatus: string | null;
  businessId: string;
  canManage: boolean;
  latestSavedMonthKey: string | null;
  firstMonth: FirstMonthSetupResult | null;
  monthSaved?: boolean;
  postSaveStatus?: FirstMonthPostSaveStatus | null;
  firstMonthSaveSeed?: FirstMonthSaveState;
  invalidMonth?: boolean;
};

/** Shows founder-facing status content for one B04 shell step without introducing later-step forms. */
function StepContent({
  step,
  businessName,
  baseCurrency,
  timezone,
  stepComplete,
  revenueSourceCount,
  revenueSources,
  revenueCreationRequestId,
  revenueStatus,
  expenseItems,
  activeExpenseCategoryCounts,
  expenseCreationRequestIds,
  expenseStatus,
  businessId,
  canManage,
  latestSavedMonthKey,
  firstMonth,
  monthSaved = false,
  postSaveStatus = null,
  firstMonthSaveSeed,
  invalidMonth = false,
}: StepContentProps) {
  if (step === "business") {
    return (
      <>
        <StepPanelHeading step={step} complete={stepComplete} />
        <dl className={styles.details}>
          <div>
            <dt>اسم البزنس</dt>
            <dd>{businessName}</dd>
          </div>
          <div>
            <dt>العملة الأساسية</dt>
            <dd dir="ltr">{baseCurrency}</dd>
          </div>
          <div>
            <dt>المنطقة الزمنية</dt>
            <dd dir="ltr">{timezone}</dd>
          </div>
        </dl>
      </>
    );
  }

  if (step === "revenue") {
    return (
      <RevenueSetupContent
        businessId={businessId}
        canManage={canManage}
        stepComplete={stepComplete}
        revenueSourceCount={revenueSourceCount}
        revenueSources={revenueSources ?? []}
        creationRequestId={revenueCreationRequestId}
        status={revenueStatus}
      />
    );
  }

  if (step === "expenses") {
    return (
      <>
        <StepPanelHeading step={step} complete={stepComplete} />
        <ExpenseSetupContent
          businessId={businessId}
          canManage={canManage}
          stepComplete={stepComplete}
          expenseItems={expenseItems ?? []}
          activeExpenseCategoryCounts={
            activeExpenseCategoryCounts ?? {
              acquisition: 0,
              fulfillment: 0,
              overhead: 0,
              financial: 0,
            }
          }
          creationRequestIds={expenseCreationRequestIds}
          status={expenseStatus}
        />
      </>
    );
  }

  return (
    <>
      <StepPanelHeading step={step} complete={stepComplete} />
      {firstMonth ? (
        <FirstMonthSetupContent
          businessId={businessId}
          baseCurrency={baseCurrency}
          canManage={canManage}
          latestSavedMonthKey={latestSavedMonthKey}
          firstMonth={firstMonth}
          monthSaved={monthSaved}
          postSaveStatus={postSaveStatus}
          firstMonthSaveSeed={firstMonthSaveSeed}
          invalidMonth={invalidMonth}
        />
      ) : (
        <p className={styles.stepDescription} role="alert">
          تعذر تحميل بيانات الشهر. أعد تحميل الصفحة.
        </p>
      )}
    </>
  );
}

const REVENUE_STATUS_MESSAGES: Readonly<Record<string, { tone: "success" | "error"; text: string }>> = {
  created: { tone: "success", text: "تمت إضافة مصدر الإيراد. يمكنك إضافة مصدر آخر أو المتابعة." },
  invalid: { tone: "error", text: "اكتب اسمًا صحيحًا لمصدر الإيراد وحاول مرة أخرى." },
  "create-failed": {
    tone: "error",
    text: "تعذر إضافة مصدر الإيراد. لم يتم تغيير أي بيانات.",
  },
};

type RevenueSetupContentProps = {
  businessId: string;
  canManage: boolean;
  stepComplete: boolean;
  revenueSourceCount: number | null;
  revenueSources: SetupRevenueSource[];
  creationRequestId: string | null;
  status: string | null;
};

/** Renders the simplified B06 Money-In question without exposing advanced revenue classification. */
function RevenueSetupContent({
  businessId,
  canManage,
  stepComplete,
  revenueSourceCount,
  revenueSources,
  creationRequestId,
  status,
}: RevenueSetupContentProps) {
  const statusMessage = status ? REVENUE_STATUS_MESSAGES[status] : undefined;

  return (
    <>
      <StepPanelHeading step="revenue" complete={stepComplete} />

      <div className={styles.moneyInIntro}>
        <h3>ما الذي تبيعُه أو تحصل منه على إيراد؟</h3>
        <p>
          أضف المنتجات أو الخدمات أو مصادر الإيراد التي يدفع لك العملاء مقابلها. نحتاج الاسم فقط الآن.
        </p>
      </div>

      {statusMessage && (
        <div
          className={
            statusMessage.tone === "success" ? styles.setupSuccess : styles.setupError
          }
          role="status"
        >
          {statusMessage.text}
        </div>
      )}

      {canManage && creationRequestId ? (
        <form action={createRevenueStream} className={styles.moneyInForm}>
          <input type="hidden" name="business_id" value={businessId} />
          <input type="hidden" name="stream_type" value="other" />
          <input type="hidden" name="creation_request_id" value={creationRequestId} />
          <input type="hidden" name="destination" value="setup" />

          <label className={styles.moneyInLabel} htmlFor="setup-revenue-name">
            اسم المنتج أو الخدمة
          </label>
          <div className={styles.moneyInControls}>
            <input
              id="setup-revenue-name"
              className={styles.moneyInInput}
              name="name"
              maxLength={120}
              placeholder="مثال: الكورس الأساسي"
              autoComplete="off"
            />
            <button className={styles.moneyInAddButton} type="submit">
              إضافة مصدر الإيراد
            </button>
          </div>
        </form>
      ) : (
        <p className={styles.readOnlySetupNote}>
          يمكنك مراجعة مصادر الإيراد الحالية، لكن الإضافة متاحة لمالك البزنس أو الأدمن.
        </p>
      )}

      <div className={styles.moneyInListBlock}>
        <div className={styles.moneyInListHeader}>
          <strong>مصادر الإيراد التي أضفتها</strong>
          <span>{revenueSourceCount ?? 0} نشط</span>
        </div>

        {revenueSources.length > 0 ? (
          <ul className={styles.moneyInList}>
            {revenueSources.map((source) => (
              <li key={source.id} className={styles.moneyInItem}>
                <span className={styles.moneyInSourceName}>{source.name}</span>
                {!source.isActive && <span className={styles.inactiveSourceBadge}>غير نشط</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.moneyInEmpty}>لا توجد مصادر إيراد بعد.</p>
        )}
      </div>
    </>
  );
}

/** Renders the shared step title and canonical completion badge. */
function StepPanelHeading({
  step,
  complete,
}: {
  step: BusinessSetupStep;
  complete: boolean;
}) {
  return (
    <div className={styles.stepPanelHeading}>
      <div>
        <span className={styles.kicker}>الخطوة {BUSINESS_SETUP_STEPS.indexOf(step) + 1}</span>
        <h2 id={`setup-step-${step}`}>{STEP_LABELS[step]}</h2>
      </div>
      <span className={complete ? styles.readyBadge : styles.pendingBadge}>
        {complete ? "مكتملة" : "تحتاج إكمال"}
      </span>
    </div>
  );
}
