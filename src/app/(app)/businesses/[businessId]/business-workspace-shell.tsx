import Link from "next/link";
import { BusinessContext } from "@/components/business-context";
import { resolveNavigationDestination } from "@/lib/navigation-hierarchy";
import {
  BUSINESS_WORKSPACE_TABS,
  buildBusinessWorkspaceHref,
  type BusinessWorkspaceTab,
} from "@/lib/business-workspace";
import styles from "./business-workspace-shell.module.css";

type BusinessWorkspaceShellProps = {
  businessId: string;
  businessName: string;
  baseCurrency: string;
  timezone: string;
  activeTab: BusinessWorkspaceTab;
  adminViewingMenteeUserId?: string | null;
};

/** Keeps business identity and local workspace navigation persistent across business setup views. */
export function BusinessWorkspaceShell({
  businessId,
  businessName,
  baseCurrency,
  timezone,
  activeTab,
  adminViewingMenteeUserId = null,
}: BusinessWorkspaceShellProps) {
  return (
    <section className={styles.workspace} aria-label="مساحة عمل البزنس">
      <BusinessContext
        businessName={businessName}
        baseCurrency={baseCurrency}
        timezone={timezone}
      />

      {adminViewingMenteeUserId && (
        <aside className={styles.adminViewingBanner} aria-label="وضع عرض بزنس متدرب">
          <div>
            <span>وضع المدير</span>
            <strong>أنت تعرض بزنس تابعًا لمتدرب.</strong>
            <p>أي تعديل تنفذه هنا سيؤثر على بيانات هذا البزنس، وليس على حسابك كمدير.</p>
          </div>
          <Link
            href={resolveNavigationDestination({
              route: "admin-mentee",
              menteeUserId: adminViewingMenteeUserId,
            })}
          >
            العودة إلى المتدرب
          </Link>
        </aside>
      )}

      <nav className={styles.tabs} aria-label="التنقل داخل البزنس">
        {BUSINESS_WORKSPACE_TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <Link
              key={tab.id}
              className={isActive ? styles.activeTab : styles.tab}
              href={buildBusinessWorkspaceHref(businessId, tab.id)}
              aria-current={isActive ? "page" : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
