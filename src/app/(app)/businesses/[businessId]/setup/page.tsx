import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import type { ExpenseCreationRequestIds } from "@/lib/business/expenses";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { loadBusinessSetup } from "@/lib/business/setup-loader";
import { parseFirstMonthPostSaveStatus } from "@/lib/business/first-month-post-save";
import { resolveResumableFirstMonthSelection } from "@/lib/business/first-month-selection";
import { loadFirstMonthSetup } from "@/lib/business/first-month-setup";
import { resolvePayoffMonthGate } from "@/lib/business/setup-payoff-result";
import { resolveSetupMonthPrimaryAction } from "@/lib/business/setup-month-action";
import {
  buildBusinessSetupHref,
  nextBusinessSetupStep,
  parseBusinessSetupMonthContext,
  parseBusinessSetupStep,
  previousBusinessSetupStep,
  resolveBusinessSetupCanonicalRedirect,
  resolveBusinessSetupResumeStep,
} from "@/lib/business/setup-navigation";
import { BusinessSetupShell } from "./business-setup-shell";

function createExpenseCreationRequestIds(): ExpenseCreationRequestIds {
  return {
    acquisition: randomUUID(),
    fulfillment: randomUUID(),
    overhead: randomUUID(),
    financial: randomUUID(),
  };
}

type BusinessSetupPageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ step?: string | string[]; status?: string | string[]; month?: string | string[] }>;
};

/**
 * Renders the dormant business-scoped setup shell with URL-addressable, canonical readiness state.
 *
 * B04 deliberately does not replace the production creation or Overview entry paths.
 */
export default async function BusinessSetupPage({
  params,
  searchParams,
}: BusinessSetupPageProps) {
  const [{ businessId: rawBusinessId }, query] = await Promise.all([params, searchParams]);
  const businessId = parseResourceId(rawBusinessId);
  if (!businessId) notFound();

  const loadResult = await loadBusinessSetup(businessId);
  if (loadResult.kind === "not_found") notFound();

  const parsedStep = parseBusinessSetupStep(query.step);
  const navigationMonthKey = parseBusinessSetupMonthContext(query.month);
  const setupStatus = typeof query.status === "string" ? query.status : null;
  const monthSaveStatus = parseFirstMonthPostSaveStatus(query.status);

  if (loadResult.kind === "load_error") {
    return (
      <BusinessSetupShell
        businessId={businessId}
        businessName={loadResult.business.name}
        baseCurrency={loadResult.business.baseCurrency}
        timezone={loadResult.business.timezone}
        currentStep={parsedStep.kind === "valid" ? parsedStep.step : null}
        readiness={loadResult.readiness}
        canManage={loadResult.canManage}
        revenueSourceCount={null}
        revenueSources={null}
        revenueCreationRequestId={null}
        revenueStatus={null}
        expenseItems={null}
        activeExpenseCategoryCounts={null}
        expenseCreationRequestIds={null}
        expenseStatus={null}
        latestSavedMonthKey={null}
        firstMonth={null}
        navigationMonthKey={null}
        backHref={null}
        nextHref={null}
        nextLabel="التالي"
        nextEnabled={false}
        loadError
      />
    );
  }

  const resumeStep = resolveBusinessSetupResumeStep(loadResult.readiness.coreSetup);

  if (parsedStep.kind !== "valid") {
    const canonicalRedirect = resolveBusinessSetupCanonicalRedirect({
      businessId,
      parsedStep,
      resumeStep,
      monthKey: navigationMonthKey,
    });
    if (canonicalRedirect) redirect(canonicalRedirect);

    return (
      <BusinessSetupShell
        businessId={businessId}
        businessName={loadResult.business.name}
        baseCurrency={loadResult.business.baseCurrency}
        timezone={loadResult.business.timezone}
        currentStep={null}
        readiness={loadResult.readiness}
        canManage={loadResult.canManage}
        revenueSourceCount={loadResult.revenueSourceCount}
        revenueSources={loadResult.revenueSources}
        revenueCreationRequestId={null}
        revenueStatus={null}
        expenseItems={loadResult.expenseItems}
        activeExpenseCategoryCounts={loadResult.activeExpenseCategoryCounts}
        expenseCreationRequestIds={null}
        expenseStatus={null}
        latestSavedMonthKey={loadResult.latestSavedMonthKey}
        firstMonth={null}
        navigationMonthKey={navigationMonthKey}
        backHref={null}
        nextHref={null}
        nextLabel="التالي"
        nextEnabled={false}
      />
    );
  }

  const currentStep = parsedStep.step;
  const monthSelection =
    currentStep === "month"
      ? resolveResumableFirstMonthSelection(
          query.month,
          loadResult.business.timezone,
          loadResult.persistedMonths,
        )
      : null;
  if (monthSelection && monthSelection.kind !== "valid") {
    const monthHref = `${buildBusinessSetupHref(businessId, "month")}&month=${monthSelection.monthKey}`;
    redirect(monthSelection.kind === "invalid" ? `${monthHref}&status=invalid-month` : monthHref);
  }
  const firstMonth =
    currentStep === "month" && monthSelection
      ? await loadFirstMonthSetup(businessId, monthSelection.monthKey, loadResult.business.timezone)
      : null;
  const previousStep = previousBusinessSetupStep(currentStep);
  const nextStep = nextBusinessSetupStep(currentStep);
  const payoffGate =
    currentStep === "month" && monthSelection
      ? resolvePayoffMonthGate(loadResult, monthSelection.monthKey)
      : null;
  const monthAction =
    currentStep === "month"
      ? resolveSetupMonthPrimaryAction({
          businessId,
          monthKey: monthSelection?.monthKey ?? null,
          gateKind: payoffGate?.kind ?? null,
          selectedMonthLoaded: firstMonth?.kind === "loaded",
          selectedMonthComplete:
            firstMonth?.kind === "loaded" &&
            firstMonth.hasSavedPeriod &&
            firstMonth.completeness?.complete === true,
          resumeStep,
        })
      : null;
  const nextEnabled =
    currentStep === "month"
      ? monthAction?.enabled === true
      : loadResult.readiness.stepComplete[currentStep];
  const backHref = previousStep
    ? buildBusinessSetupHref(businessId, previousStep, { monthKey: navigationMonthKey })
    : null;
  const nextHref =
    currentStep === "month"
      ? (monthAction?.href ?? null)
      : nextEnabled && nextStep
        ? buildBusinessSetupHref(businessId, nextStep, { monthKey: navigationMonthKey })
        : null;

  return (
    <BusinessSetupShell
      businessId={businessId}
      businessName={loadResult.business.name}
      baseCurrency={loadResult.business.baseCurrency}
      timezone={loadResult.business.timezone}
      currentStep={currentStep}
      readiness={loadResult.readiness}
      canManage={loadResult.canManage}
      revenueSourceCount={loadResult.revenueSourceCount}
      revenueSources={loadResult.revenueSources}
      revenueCreationRequestId={
        currentStep === "revenue" && loadResult.canManage ? randomUUID() : null
      }
      revenueStatus={currentStep === "revenue" ? setupStatus : null}
      expenseItems={loadResult.expenseItems}
      activeExpenseCategoryCounts={loadResult.activeExpenseCategoryCounts}
      expenseCreationRequestIds={
        currentStep === "expenses" && loadResult.canManage
          ? createExpenseCreationRequestIds()
          : null
      }
      expenseStatus={currentStep === "expenses" ? setupStatus : null}
      latestSavedMonthKey={loadResult.latestSavedMonthKey}
      firstMonth={firstMonth}
      navigationMonthKey={navigationMonthKey}
      monthSaved={currentStep === "month" && monthSaveStatus !== null}
      postSaveStatus={currentStep === "month" ? monthSaveStatus : null}
      invalidMonth={currentStep === "month" && setupStatus === "invalid-month"}
      backHref={backHref}
      nextHref={nextHref}
      nextLabel={currentStep === "month" ? (monthAction?.label ?? "إنهاء الإعداد") : "التالي"}
      nextEnabled={nextEnabled}
    />
  );
}
