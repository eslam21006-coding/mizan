import { BackLink, Breadcrumb } from "@/components/navigation-hierarchy";

type CustomerReviewNavigationProps = {
  businessId: string;
  businessName: string;
};

/** Shows the Customer Review page's deterministic parent hierarchy and Back destination. */
export function CustomerReviewNavigation({
  businessId,
  businessName,
}: CustomerReviewNavigationProps) {
  return (
    <div>
      <Breadcrumb
        ariaLabel="مسار مراجعة اقتصاديات العميل"
        items={[
          { label: "البزنسات", destination: { route: "businesses" } },
          {
            label: businessName,
            destination: { route: "business-overview", businessId },
          },
          {
            label: "العملاء وقيمة العميل",
            destination: { route: "business-customers", businessId },
          },
          { label: "المراجعة", current: true },
        ]}
      />
      <BackLink
        label="العودة للعملاء وقيمة العميل"
        destination={{ route: "business-customers", businessId }}
      />
    </div>
  );
}
