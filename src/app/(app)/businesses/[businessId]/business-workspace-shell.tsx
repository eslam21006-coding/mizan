import Link from "next/link";
import { BusinessContext } from "@/components/business-context";
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
};

/** Keeps business identity and local workspace navigation persistent across business setup views. */
export function BusinessWorkspaceShell({
  businessId,
  businessName,
  baseCurrency,
  timezone,
  activeTab,
}: BusinessWorkspaceShellProps) {
  return (
    <section className={styles.workspace} aria-label="مساحة عمل البزنس">
      <BusinessContext
        businessName={businessName}
        baseCurrency={baseCurrency}
        timezone={timezone}
      />

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
