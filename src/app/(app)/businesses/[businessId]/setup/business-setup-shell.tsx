import Link from "next/link";
import { BusinessContext } from "@/components/business-context";
import {
  BUSINESS_SETUP_STEPS,
  buildBusinessSetupHref,
  type BusinessSetupStep,
} from "@/lib/business/setup-navigation";
import type { BusinessSetupReadiness } from "@/lib/business/setup-readiness";
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
  latestSavedMonthKey: string | null;
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
  latestSavedMonthKey,
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
              latestSavedMonthKey={latestSavedMonthKey}
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
  latestSavedMonthKey: string | null;
};

/** Shows founder-facing status content for one B04 shell step without introducing later-step forms. */
function StepContent({
  step,
  businessName,
  baseCurrency,
  timezone,
  stepComplete,
  revenueSourceCount,
  latestSavedMonthKey,
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
      <>
        <StepPanelHeading step={step} complete={stepComplete} />
        <p className={styles.stepDescription}>
          {stepComplete
            ? `لديك ${revenueSourceCount ?? 0} مصدر إيراد نشط على الأقل، لذلك هذه الخطوة مكتملة.`
            : "حدد ما تبيعه أو تحصل منه على إيراد حتى يعرف ميزان من أين يدخل المال إلى البزنس."}
        </p>
      </>
    );
  }

  if (step === "expenses") {
    return (
      <>
        <StepPanelHeading step={step} complete={stepComplete} />
        <p className={styles.stepDescription}>
          {stepComplete
            ? "تمت مراجعة إعداد المصروفات بشكل صريح، بما في ذلك حالة عدم وجود مصروفات."
            : "راجع أين يذهب المال في البزنس. لا تعتبر هذه الخطوة مكتملة حتى يتم تأكيد مراجعة المصروفات صراحة."}
        </p>
      </>
    );
  }

  return (
    <>
      <StepPanelHeading step={step} complete={stepComplete} />
      <p className={styles.stepDescription}>
        {stepComplete && latestSavedMonthKey
          ? `لديك شهر محفوظ بالفعل: ${latestSavedMonthKey}. هذه الخطوة مكتملة.`
          : "أضف أول شهر فعلي حتى يستطيع ميزان بناء الصورة المالية للبزنس على بيانات حقيقية."}
      </p>
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
