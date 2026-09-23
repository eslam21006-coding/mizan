import Link from "next/link";
import { BackLink, Breadcrumb } from "@/components/navigation-hierarchy";
import { PageHeading } from "@/components/page-heading";
import { resolveNavigationDestination } from "@/lib/navigation-hierarchy";
import { BusinessWorkspaceShell } from "../business-workspace-shell";
import styles from "../workspace-page.module.css";
import settingsStyles from "./business-settings.module.css";

export type BusinessSettingsIdentity = {
  id: string;
  name: string;
  baseCurrency: string;
  timezone: string;
};

type BusinessSettingsViewProps = {
  business: BusinessSettingsIdentity;
  canDelete: boolean;
};

/** Renders the authoritative Business Settings hierarchy independently from data loading. */
export function BusinessSettingsView({ business, canDelete }: BusinessSettingsViewProps) {
  return (
    <div className="page-stack">
      <BusinessWorkspaceShell
        businessId={business.id}
        businessName={business.name}
        baseCurrency={business.baseCurrency}
        timezone={business.timezone}
        activeTab="settings"
      />

      <Breadcrumb
        items={[
          { label: "البزنسات", destination: { route: "businesses" } },
          {
            label: business.name,
            destination: { route: "business-workspace", businessId: business.id },
          },
          { label: "الإعدادات", current: true },
        ]}
        ariaLabel="مسار إعدادات البزنس"
      />

      <BackLink
        label="العودة إلى نظرة عامة"
        destination={{ route: "business-workspace", businessId: business.id }}
      />

      <PageHeading
        title="إعدادات البزنس"
        description={`راجع بيانات ${business.name} الأساسية والإجراءات الخاصة بهذا البزنس من داخل مساحة عمله.`}
      />

      <section className={styles.panel} aria-labelledby="business-identity-heading">
        <strong id="business-identity-heading">هوية البزنس</strong>
        <dl className={styles.settingsList}>
          <div>
            <dt>اسم البزنس</dt>
            <dd>{business.name}</dd>
          </div>
          <div>
            <dt>العملة الأساسية</dt>
            <dd dir="ltr">{business.baseCurrency}</dd>
          </div>
          <div>
            <dt>المنطقة الزمنية</dt>
            <dd dir="ltr">{business.timezone}</dd>
          </div>
        </dl>
      </section>

      {canDelete && (
        <section className={settingsStyles.dangerZone} aria-labelledby="business-danger-heading">
          <div>
            <strong id="business-danger-heading">منطقة خطرة</strong>
            <p>حذف البزنس إجراء دائم ويتطلب تأكيدًا يدويًا في خطوة منفصلة.</p>
          </div>
          <Link
            className={settingsStyles.deleteLink}
            href={resolveNavigationDestination({ route: "business-delete", businessId: business.id })}
          >
            حذف البزنس
          </Link>
        </section>
      )}
    </div>
  );
}
