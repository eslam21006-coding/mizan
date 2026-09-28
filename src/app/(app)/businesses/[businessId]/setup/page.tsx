import { notFound, redirect } from "next/navigation";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { loadBusinessSetup } from "@/lib/business/setup-loader";
import {
  buildBusinessSetupHref,
  nextBusinessSetupStep,
  parseBusinessSetupStep,
  previousBusinessSetupStep,
  resolveBusinessSetupResumeStep,
} from "@/lib/business/setup-navigation";
import { BusinessSetupShell } from "./business-setup-shell";

type BusinessSetupPageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ step?: string | string[] }>;
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
        latestSavedMonthKey={null}
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
    if (resumeStep) {
      redirect(buildBusinessSetupHref(businessId, resumeStep));
    }
    if (parsedStep.kind === "invalid") {
      redirect(buildBusinessSetupHref(businessId));
    }

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
        latestSavedMonthKey={loadResult.latestSavedMonthKey}
        backHref={null}
        nextHref={null}
        nextLabel="التالي"
        nextEnabled={false}
      />
    );
  }

  const currentStep = parsedStep.step;
  const previousStep = previousBusinessSetupStep(currentStep);
  const nextStep = nextBusinessSetupStep(currentStep);
  const nextEnabled = loadResult.readiness.stepComplete[currentStep];
  const backHref = previousStep ? buildBusinessSetupHref(businessId, previousStep) : null;
  const nextHref = nextEnabled
    ? nextStep
      ? buildBusinessSetupHref(businessId, nextStep)
      : buildBusinessSetupHref(businessId)
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
      latestSavedMonthKey={loadResult.latestSavedMonthKey}
      backHref={backHref}
      nextHref={nextHref}
      nextLabel={currentStep === "month" ? "إنهاء الإعداد" : "التالي"}
      nextEnabled={nextEnabled}
    />
  );
}
