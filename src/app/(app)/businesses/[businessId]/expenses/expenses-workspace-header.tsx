import { BackLink, Breadcrumb } from "@/components/navigation-hierarchy";
import { PageHeader } from "@/components/page-header";
import {
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_COST_BEHAVIOR_OPTIONS,
} from "@/lib/business/expenses";
import type { BreadcrumbItem } from "@/lib/navigation-hierarchy";
import type { SetupReturnOrigin } from "@/lib/setup-return-origin";
import { BusinessWorkspaceShell } from "../business-workspace-shell";
import { ExpenseDrawerLauncher } from "./expense-drawer";

type ExpensesWorkspaceHeaderProps = {
  businessId: string;
  businessName: string;
  baseCurrency: string;
  timezone: string;
  canManage: boolean;
  adminViewingMenteeUserId?: string | null;
  returnOrigin: SetupReturnOrigin | null;
  creationRequestId: string;
};

/** Keeps Expense Structure anchored to the Business workspace hierarchy and stable action grammar. */
export function ExpensesWorkspaceHeader({
  businessId,
  businessName,
  baseCurrency,
  timezone,
  canManage,
  adminViewingMenteeUserId,
  returnOrigin,
  creationRequestId,
}: ExpensesWorkspaceHeaderProps) {
  const breadcrumbItems = [
    { label: "البزنسات", destination: { route: "businesses" } },
    {
      label: businessName,
      destination: { route: "business-workspace", businessId },
    },
    { label: "هيكل المصروفات", current: true },
  ] satisfies readonly BreadcrumbItem[];

  return (
    <>
      <BusinessWorkspaceShell
        businessId={businessId}
        businessName={businessName}
        baseCurrency={baseCurrency}
        timezone={timezone}
        activeTab="expenses"
        adminViewingMenteeUserId={adminViewingMenteeUserId}
      />

      <Breadcrumb items={breadcrumbItems} />

      <BackLink
        label="العودة إلى نظرة عامة"
        destination={{ route: "business-workspace", businessId }}
      />

      <PageHeader
        title="هيكل المصروفات"
        description={`عرّف مصروفات ${businessName} وطريقة سلوك كل تكلفة بدون إدخال أي أرقام مالية الآن.`}
        actionState={canManage ? "normal" : "read-only"}
        actionsAriaLabel="إجراءات هيكل المصروفات"
        actions={
          canManage ? (
            <ExpenseDrawerLauncher
              businessId={businessId}
              returnOrigin={returnOrigin}
              categoryOptions={EXPENSE_CATEGORY_OPTIONS}
              behaviorOptions={EXPENSE_COST_BEHAVIOR_OPTIONS}
              mode="create"
              creationRequestId={creationRequestId}
            />
          ) : undefined
        }
      />
    </>
  );
}
