import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BusinessSetupShell } from "@/app/(app)/businesses/[businessId]/setup/business-setup-shell";
import {
  buildBusinessSetupHref,
  nextBusinessSetupStep,
  parseBusinessSetupStep,
  previousBusinessSetupStep,
  resolveBusinessSetupResumeStep,
} from "@/lib/business/setup-navigation";
import { resolveBusinessSetupReadiness } from "@/lib/business/setup-readiness";
import type {
  ExpenseCategoryCounts,
  SetupExpenseItem,
} from "@/lib/business/expenses";
import type { SetupRevenueSource } from "@/lib/business/setup-loader";
import type { FirstMonthSetupResult } from "@/lib/business/first-month-setup";
import { parseFirstMonthPostSaveStatus } from "@/lib/business/first-month-post-save";
import {
  resolveResumableFirstMonthSelection,
  type FirstMonthResumeMonths,
} from "@/lib/business/first-month-selection";

export const dynamic = "force-dynamic";

const businessId = "123e4567-e89b-42d3-a456-426614174000";
const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

type FixtureCase =
  | "empty"
  | "revenue"
  | "reviewed"
  | "complete"
  | "out-of-order"
  | "inactive-only"
  | "multiple"
  | "expenses-mixed"
  | "expenses-inactive-only"
  | "expenses-reviewed-none"
  | "expenses-read-only"
  | "month-empty"
  | "month-partial"
  | "month-saved"
  | "month-complete"
  | "month-setup-pending"
  | "month-error"
  | "month-read-only"
  | "month-load-error"
  | "load-error";

const CASES: Record<
  Exclude<FixtureCase, "load-error">,
  {
    revenueSourceCount: number;
    reviewedAt: string | null;
    validMonthCount: number;
    canManage?: boolean;
    revenueSources?: SetupRevenueSource[];
    expenseItems?: SetupExpenseItem[];
    activeExpenseCategoryCounts?: ExpenseCategoryCounts;
  }
> = {
  empty: { revenueSourceCount: 0, reviewedAt: null, validMonthCount: 0, revenueSources: [] },
  revenue: {
    revenueSourceCount: 1,
    reviewedAt: null,
    validMonthCount: 0,
    canManage: false,
    revenueSources: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "الكورس الأساسي",
        streamType: "other",
        isActive: true,
      },
    ],
  },
  reviewed: {
    revenueSourceCount: 1,
    reviewedAt: "2026-09-28T10:00:00.000Z",
    validMonthCount: 0,
  },
  complete: {
    revenueSourceCount: 1,
    reviewedAt: "2026-09-28T10:00:00.000Z",
    validMonthCount: 1,
  },
  "out-of-order": {
    revenueSourceCount: 0,
    reviewedAt: "2026-09-28T10:00:00.000Z",
    validMonthCount: 1,
    revenueSources: [],
  },
  "inactive-only": {
    revenueSourceCount: 0,
    reviewedAt: null,
    validMonthCount: 0,
    revenueSources: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "عرض قديم",
        streamType: "other",
        isActive: false,
      },
    ],
  },
  multiple: {
    revenueSourceCount: 3,
    reviewedAt: null,
    validMonthCount: 0,
    revenueSources: [
      {
        id: "33333333-3333-4333-8333-333333333331",
        name: "الكورس الأساسي",
        streamType: "other",
        isActive: true,
      },
      {
        id: "33333333-3333-4333-8333-333333333332",
        name: "VIP",
        streamType: "other",
        isActive: true,
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        name: "Mastermind",
        streamType: "other",
        isActive: true,
      },
    ],
  },
  "expenses-mixed": {
    revenueSourceCount: 1,
    reviewedAt: null,
    validMonthCount: 0,
    expenseItems: [
      {
        id: "66666666-6666-4666-8666-666666666661",
        name: "Meta Ads",
        category: "acquisition",
        costBehavior: "fixed_monthly",
        isActive: true,
      },
      {
        id: "66666666-6666-4666-8666-666666666662",
        name: "Zoom",
        category: "overhead",
        costBehavior: "fixed_monthly",
        isActive: true,
      },
    ],
    activeExpenseCategoryCounts: {
      acquisition: 1,
      fulfillment: 0,
      overhead: 1,
      financial: 0,
    },
  },
  "expenses-inactive-only": {
    revenueSourceCount: 1,
    reviewedAt: null,
    validMonthCount: 0,
    expenseItems: [
      {
        id: "77777777-7777-4777-8777-777777777777",
        name: "بوابة دفع قديمة جدًا باسم طويل لاختبار الالتفاف على شاشة الموبايل",
        category: "financial",
        costBehavior: "percentage_revenue",
        isActive: false,
      },
    ],
    activeExpenseCategoryCounts: {
      acquisition: 0,
      fulfillment: 0,
      overhead: 0,
      financial: 0,
    },
  },
  "expenses-reviewed-none": {
    revenueSourceCount: 1,
    reviewedAt: "2026-09-30T12:00:00.000Z",
    validMonthCount: 0,
    expenseItems: [],
    activeExpenseCategoryCounts: {
      acquisition: 0,
      fulfillment: 0,
      overhead: 0,
      financial: 0,
    },
  },
  "expenses-read-only": {
    revenueSourceCount: 1,
    reviewedAt: null,
    validMonthCount: 0,
    canManage: false,
    expenseItems: [
      {
        id: "88888888-8888-4888-8888-888888888888",
        name: "Meta Ads",
        category: "acquisition",
        costBehavior: "fixed_monthly",
        isActive: true,
      },
    ],
    activeExpenseCategoryCounts: {
      acquisition: 1,
      fulfillment: 0,
      overhead: 0,
      financial: 0,
    },
  },
  "month-empty": {
    revenueSourceCount: 2,
    reviewedAt: "2026-09-30T12:00:00.000Z",
    validMonthCount: 0,
  },
  "month-partial": {
    revenueSourceCount: 2,
    reviewedAt: "2026-09-30T12:00:00.000Z",
    validMonthCount: 0,
  },
  "month-saved": {
    revenueSourceCount: 2,
    reviewedAt: "2026-09-30T12:00:00.000Z",
    validMonthCount: 1,
  },
  "month-complete": {
    revenueSourceCount: 2,
    reviewedAt: "2026-09-30T12:00:00.000Z",
    validMonthCount: 1,
  },
  "month-setup-pending": {
    revenueSourceCount: 2,
    reviewedAt: null,
    validMonthCount: 1,
  },
  "month-error": {
    revenueSourceCount: 2,
    reviewedAt: "2026-09-30T12:00:00.000Z",
    validMonthCount: 0,
  },
  "month-read-only": {
    revenueSourceCount: 2,
    reviewedAt: "2026-09-30T12:00:00.000Z",
    validMonthCount: 0,
    canManage: false,
  },
  "month-load-error": {
    revenueSourceCount: 2,
    reviewedAt: "2026-09-30T12:00:00.000Z",
    validMonthCount: 0,
  },
};

function fixtureFirstMonth(
  fixtureCase: FixtureCase,
  monthKey: string,
): FirstMonthSetupResult {
  if (fixtureCase === "month-load-error") {
    return { kind: "load_error", selectedMonthKey: monthKey, currentMonthKey: "2026-10" };
  }

  const populated = fixtureCase === "month-partial" || fixtureCase === "month-saved" || fixtureCase === "month-complete" || fixtureCase === "month-setup-pending";
  const historical = fixtureCase === "month-saved";
  const complete = historical || fixtureCase === "month-complete" || fixtureCase === "month-setup-pending";
  return {
    kind: "loaded",
    selectedMonthKey: monthKey,
    currentMonthKey: "2026-10",
    hasSavedPeriod: populated,
    isSavedHistorical: historical,
    completeness: {
      complete: populated && complete,
      meaningful: populated,
      missing: populated && complete ? [] : ["new_customers"],
    },
    period: populated
      ? {
          new_customers: complete ? 20 : null,
          total_paying_customers: 35,
          unallocated_gross_cash_collected: "0",
          unallocated_refunds: null,
          adjustment_note: null,
        }
      : null,
    revenueRows: [
      {
        id: "a1111111-1111-4111-8111-111111111111",
        name: "الكورس الأساسي",
        streamType: "other",
        active: true,
        gross: populated ? "5000" : "",
        refunds: populated ? "200" : "",
      },
      {
        id: "a2222222-2222-4222-8222-222222222222",
        name: historical ? "VIP — اسم محفوظ من شهر سابق" : "VIP",
        streamType: "other",
        active: !historical,
        gross: populated ? "2000" : "",
        refunds: populated ? "0" : "",
      },
    ],
    expenseRows: [
      {
        id: "b1111111-1111-4111-8111-111111111111",
        name: "Meta Ads",
        category: "acquisition",
        behavior: "fixed_monthly",
        active: true,
        value: populated ? "1500" : "",
        basis: "",
      },
      {
        id: "b2222222-2222-4222-8222-222222222222",
        name: "Coach",
        category: "fulfillment",
        behavior: "per_customer",
        active: true,
        value: populated ? "20" : "",
        basis: populated ? "total_paying_customers" : "",
      },
      {
        id: "b3333333-3333-4333-8333-333333333333",
        name: historical ? "رسوم بوابة قديمة — تاريخ محفوظ" : "بوابة الدفع",
        category: "financial",
        behavior: "percentage_revenue",
        active: !historical,
        value: populated ? "3" : "",
        basis: "",
      },
    ],
    payingCustomersDerived: populated,
    newCustomersDerived: complete,
  };
}

function fixturePersistedMonths(fixtureCase: FixtureCase): FirstMonthResumeMonths {
  switch (fixtureCase) {
    case "month-partial":
      return { savedMonthKeys: ["2026-09"], completedMonthKeys: [] };
    case "month-saved":
      return { savedMonthKeys: ["2026-09"], completedMonthKeys: ["2026-09"] };
    case "month-complete":
    case "month-setup-pending":
      return { savedMonthKeys: ["2026-10"], completedMonthKeys: ["2026-10"] };
    default:
      return { savedMonthKeys: [], completedMonthKeys: [] };
  }
}

type SetupFixturePageProps = {
  searchParams: Promise<{ case?: string; step?: string; month?: string; status?: string }>;
};

/** CI-only fixture that renders the production B04 setup shell from deterministic readiness facts. */
export default async function SetupFixturePage({ searchParams }: SetupFixturePageProps) {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  const query = await searchParams;
  const fixtureCase: FixtureCase =
    query.case === "revenue" ||
    query.case === "reviewed" ||
    query.case === "complete" ||
    query.case === "out-of-order" ||
    query.case === "inactive-only" ||
    query.case === "multiple" ||
    query.case === "expenses-mixed" ||
    query.case === "expenses-inactive-only" ||
    query.case === "expenses-reviewed-none" ||
    query.case === "expenses-read-only" ||
    query.case === "month-empty" ||
    query.case === "month-partial" ||
    query.case === "month-saved" ||
    query.case === "month-complete" ||
    query.case === "month-setup-pending" ||
    query.case === "month-error" ||
    query.case === "month-read-only" ||
    query.case === "month-load-error" ||
    query.case === "load-error"
      ? query.case
      : "empty";
  const parsedStep = parseBusinessSetupStep(query.step);

  const readiness =
    fixtureCase === "load-error"
      ? resolveBusinessSetupReadiness({
          loadState: "load_error",
          revenueSourceCount: null,
          expenseSetupReviewedAt: null,
          validMonthCount: null,
        })
      : resolveBusinessSetupReadiness({
          loadState: "loaded",
          revenueSourceCount: CASES[fixtureCase].revenueSourceCount,
          expenseSetupReviewedAt: CASES[fixtureCase].reviewedAt,
          validMonthCount: CASES[fixtureCase].validMonthCount,
        });

  const resumeStep = resolveBusinessSetupResumeStep(readiness.coreSetup);
  const currentStep =
    parsedStep.kind === "valid"
      ? parsedStep.step
      : fixtureCase === "complete" && resumeStep === null
        ? null
        : resumeStep;
  const previousStep = currentStep ? previousBusinessSetupStep(currentStep) : null;
  const nextStep = currentStep ? nextBusinessSetupStep(currentStep) : null;
  const nextEnabled =
    fixtureCase !== "load-error" &&
    fixtureCase !== "month-load-error" &&
    currentStep !== null &&
    readiness.stepComplete[currentStep];
  const persistedMonths = fixturePersistedMonths(fixtureCase);
  const monthSelection = resolveResumableFirstMonthSelection(
    query.month,
    "Africa/Cairo",
    persistedMonths,
    new Date("2026-10-05T08:00:00.000Z"),
  );
  const selectedMonthKey = monthSelection.monthKey;
  const firstMonth =
    currentStep === "month" ? fixtureFirstMonth(fixtureCase, selectedMonthKey) : null;
  const canManage =
    fixtureCase === "load-error" ? true : (CASES[fixtureCase].canManage ?? true);

  return (
    <AppShell {...fixtureShellProps}>
      <BusinessSetupShell
        businessId={businessId}
        businessName="أكاديمية ميزان"
        baseCurrency="USD"
        timezone="Africa/Cairo"
        currentStep={currentStep}
        readiness={readiness}
        canManage={canManage}
        revenueSourceCount={
          fixtureCase === "load-error" ? null : CASES[fixtureCase].revenueSourceCount
        }
        revenueSources={
          fixtureCase === "load-error" ? null : (CASES[fixtureCase].revenueSources ?? [])
        }
        revenueCreationRequestId={
          fixtureCase === "load-error" || currentStep !== "revenue"
            ? null
            : "44444444-4444-4444-8444-444444444444"
        }
        revenueStatus={null}
        expenseItems={
          fixtureCase === "load-error" ? null : (CASES[fixtureCase].expenseItems ?? [])
        }
        activeExpenseCategoryCounts={
          fixtureCase === "load-error"
            ? null
            : (CASES[fixtureCase].activeExpenseCategoryCounts ?? {
                acquisition: 0,
                fulfillment: 0,
                overhead: 0,
                financial: 0,
              })
        }
        expenseCreationRequestIds={
          currentStep === "expenses" && canManage
            ? {
                acquisition: "55555555-5555-4555-8555-555555555551",
                fulfillment: "55555555-5555-4555-8555-555555555552",
                overhead: "55555555-5555-4555-8555-555555555553",
                financial: "55555555-5555-4555-8555-555555555554",
              }
            : null
        }
        expenseStatus={null}
        latestSavedMonthKey={persistedMonths.savedMonthKeys[0] ?? null}
        firstMonth={firstMonth}
        monthSaved={parseFirstMonthPostSaveStatus(query.status) !== null}
        postSaveStatus={parseFirstMonthPostSaveStatus(query.status)}
        firstMonthSaveSeed={fixtureCase === "month-error" ? {
          attempt: 1,
          status: "error",
          code: "invalid-input",
          fieldErrors: {
            "expense_basis_b2222222-2222-4222-8222-222222222222": "اختر أساس عدد العملاء لهذا المصروف.",
          },
          draft: {
            "gross_a1111111-1111-4111-8111-111111111111": "5000",
            "expense_value_b2222222-2222-4222-8222-222222222222": "20",
            "expense_basis_b2222222-2222-4222-8222-222222222222": "",
          },
        } : undefined}
        invalidMonth={query.status === "invalid-month"}
        backHref={
          previousStep ? buildBusinessSetupHref(businessId, previousStep) : null
        }
        nextHref={
          nextEnabled
            ? nextStep
              ? buildBusinessSetupHref(businessId, nextStep)
              : buildBusinessSetupHref(businessId)
            : null
        }
        nextLabel={currentStep === "month" ? "إنهاء الإعداد" : "التالي"}
        nextEnabled={nextEnabled}
        loadError={fixtureCase === "load-error"}
      />
    </AppShell>
  );
}
