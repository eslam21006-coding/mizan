import { resolveNavigationDestination } from "./navigation-hierarchy.ts";
import {
  parseReturnOrigin,
  resolveReturnOrigin,
  type ReturnOriginMetadata,
  type ReturnOriginSearchParams,
} from "./return-origin.ts";

export type TransactionImportReturnOrigin = Exclude<
  ReturnOriginMetadata,
  { origin: "funnel-structure" }
>;

export type TransactionImportReturnAction = {
  href: string;
  label: string;
  description: string;
};

/** Accepts only customer/Monthly origins that belong to the Transaction Import workflow. */
export function parseTransactionImportReturnOrigin(
  searchParams: ReturnOriginSearchParams,
): TransactionImportReturnOrigin | null {
  const parsed = parseReturnOrigin(searchParams);
  return parsed?.origin === "funnel-structure" ? null : parsed;
}

/** Builds the canonical Import URL while carrying only allow-listed structured origin metadata. */
export function buildTransactionImportHref(
  businessId: string,
  origin: TransactionImportReturnOrigin | null = null,
  historyStatus?: string | null,
) {
  const pathname = `/businesses/${encodeURIComponent(businessId)}/customers/import`;
  const searchParams = new URLSearchParams();

  if (origin) {
    searchParams.set("origin", origin.origin);
    if ("month" in origin && origin.month) {
      searchParams.set("month", origin.month);
    }
  }

  if (historyStatus) {
    searchParams.set("historyStatus", historyStatus);
  }

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** Resolves the Import workflow's safe Cancel/completion destination and context-specific copy. */
export function transactionImportReturnAction(
  origin: TransactionImportReturnOrigin | null,
  businessId: string,
): TransactionImportReturnAction {
  if (!origin) {
    return {
      href: resolveNavigationDestination({ route: "business-customers", businessId }),
      label: "عرض تحليل العملاء",
      description:
        "افتح تحليل العملاء؛ العملاء وCohorts وObserved LTV تُقرأ من سجل المعاملات المحفوظ فعلًا.",
    };
  }

  const href = resolveNavigationDestination(resolveReturnOrigin(origin, { businessId }));

  switch (origin.origin) {
    case "customer-overview":
      return {
        href,
        label: "العودة إلى تحليل العملاء",
        description: "ارجع إلى تحليل العملاء بعد تحديث سجل المعاملات.",
      };
    case "customer-profitability":
      return {
        href,
        label: "العودة إلى ربحية العميل",
        description: "ارجع إلى نفس سياق ربحية العميل بعد تحديث سجل المعاملات.",
      };
    case "monthly-editor":
      return {
        href,
        label: "العودة إلى الإدخال الشهري",
        description: "ارجع إلى نفس شهر الإدخال الشهري بعد تحديث سجل المعاملات.",
      };
  }
}
