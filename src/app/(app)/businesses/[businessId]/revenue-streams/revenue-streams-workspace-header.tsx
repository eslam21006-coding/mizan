import { BackLink, Breadcrumb } from "@/components/navigation-hierarchy";
import { PageHeader } from "@/components/page-header";
import { REVENUE_STREAM_TYPE_OPTIONS } from "@/lib/business/revenue-streams";
import type { BreadcrumbItem } from "@/lib/navigation-hierarchy";
import type { SetupReturnOrigin } from "@/lib/setup-return-origin";
import { BusinessWorkspaceShell } from "../business-workspace-shell";
import { RevenueStreamDrawerLauncher } from "./revenue-stream-drawer";

type RevenueStreamsWorkspaceHeaderProps = {
  businessId: string;
  businessName: string;
  baseCurrency: string;
  timezone: string;
  canManage: boolean;
  adminViewingMenteeUserId?: string | null;
  returnOrigin: SetupReturnOrigin | null;
  creationRequestId: string;
};

/** Keeps Revenue Sources anchored to the Business workspace hierarchy and stable action grammar. */
export function RevenueStreamsWorkspaceHeader({
  businessId,
  businessName,
  baseCurrency,
  timezone,
  canManage,
  adminViewingMenteeUserId,
  returnOrigin,
  creationRequestId,
}: RevenueStreamsWorkspaceHeaderProps) {
  const breadcrumbItems = [
    { label: "البزنسات", destination: { route: "businesses" } },
    {
      label: businessName,
      destination: { route: "business-workspace", businessId },
    },
    { label: "مصادر الإيراد", current: true },
  ] satisfies readonly BreadcrumbItem[];

  return (
    <>
      <BusinessWorkspaceShell
        businessId={businessId}
        businessName={businessName}
        baseCurrency={baseCurrency}
        timezone={timezone}
        activeTab="revenue-streams"
        adminViewingMenteeUserId={adminViewingMenteeUserId}
      />

      <Breadcrumb items={breadcrumbItems} />

      <BackLink
        label="العودة إلى نظرة عامة"
        destination={{ route: "business-workspace", businessId }}
      />

      <PageHeader
        title="مصادر الإيراد"
        description={`نظّم طرق دخول الإيراد في ${businessName} بدون إدخال أي أرقام مالية الآن.`}
        actionState={canManage ? "normal" : "read-only"}
        actionsAriaLabel="إجراءات مصادر الإيراد"
        actions={
          canManage ? (
            <RevenueStreamDrawerLauncher
              businessId={businessId}
              returnOrigin={returnOrigin}
              typeOptions={REVENUE_STREAM_TYPE_OPTIONS}
              mode="create"
              creationRequestId={creationRequestId}
            />
          ) : undefined
        }
      />
    </>
  );
}
