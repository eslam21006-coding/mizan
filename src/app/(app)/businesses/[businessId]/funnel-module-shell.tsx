import Link from "next/link";
import {
  FUNNEL_MODULE_TABS,
  buildFunnelModuleHref,
  type FunnelModuleOrigin,
  type FunnelModuleTab,
} from "@/lib/funnel-module";
import styles from "./funnel-module-shell.module.css";

type FunnelModuleShellProps = {
  businessId: string;
  activeTab: FunnelModuleTab;
  monthKey?: string | null;
  origin?: FunnelModuleOrigin | null;
};

/** Keeps the three Funnel workflows visibly connected as one persistent module. */
export function FunnelModuleShell({
  businessId,
  activeTab,
  monthKey,
  origin,
}: FunnelModuleShellProps) {
  return (
    <section className={styles.module} aria-label="وحدة الفانلز">
      <span className={styles.label}>الفانلز</span>
      <nav className={styles.tabs} aria-label="التنقل داخل وحدة الفانلز">
        {FUNNEL_MODULE_TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <Link
              key={tab.id}
              className={isActive ? styles.activeTab : styles.tab}
              href={buildFunnelModuleHref(
                businessId,
                tab.id,
                monthKey,
                tab.id === "monthly"
                  ? activeTab === "structure"
                    ? "funnel-structure"
                    : origin
                  : null,
              )}
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
