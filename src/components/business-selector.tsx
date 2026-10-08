"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { MizanRole } from "@/lib/auth/role";
import { AppNavigation } from "./app-navigation";
import {
  manageBusinessesHref,
  resolveBusinessSwitchHref,
  resolveShellBusinessId,
  type ShellBusiness,
} from "@/lib/business-shell-context";
import styles from "./app-shell.module.css";

type BusinessSelectorProps = {
  businesses: readonly ShellBusiness[];
  selectedBusinessId: string | null;
  pathname: string;
  search: string;
  loadFailed?: boolean;
  onNavigate?: () => void;
};

type BusinessContextNavigationProps = {
  role: MizanRole;
  businesses: readonly ShellBusiness[];
  businessesLoadFailed?: boolean;
  onNavigate?: () => void;
};

/** Renders the persistent shell business selector without introducing new persisted state. */
export function BusinessSelector({
  businesses,
  selectedBusinessId,
  pathname,
  search,
  loadFailed = false,
  onNavigate,
}: BusinessSelectorProps) {
  const router = useRouter();

  /** Switches business while preserving only route-safe context from B14A. */
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const targetBusinessId = event.target.value;
    if (!targetBusinessId || targetBusinessId === selectedBusinessId) {
      return;
    }

    router.push(
      resolveBusinessSwitchHref({
        pathname,
        search,
        targetBusinessId,
      }),
    );
    onNavigate?.();
  };

  return (
    <section className={styles.businessSelector} aria-label="اختيار البزنس">
      {loadFailed ? (
        <div className={styles.businessSelectorEmpty} role="status">
          تعذر تحميل البزنسات
        </div>
      ) : businesses.length > 0 ? (
        <label className={styles.businessSelectorField}>
          <span>البزنس الحالي</span>
          <select
            aria-label="البزنس الحالي"
            value={selectedBusinessId ?? businesses[0]?.id ?? ""}
            onChange={handleChange}
          >
            {businesses.map((business) => (
              <option key={business.id} value={business.id}>
                {business.name} — {business.baseCurrency}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className={styles.businessSelectorEmpty}>لا يوجد بزنس بعد</div>
      )}

      <Link
        className={styles.manageBusinessesLink}
        href={manageBusinessesHref()}
        onClick={onNavigate}
      >
        إدارة البزنسات
      </Link>
    </section>
  );
}


/** Resolves URL business context once and shares it across selector and navigation. */
export function BusinessContextNavigation({
  role,
  businesses,
  businessesLoadFailed = false,
  onNavigate,
}: BusinessContextNavigationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const selectedBusinessId = businessesLoadFailed
    ? null
    : resolveShellBusinessId({
        pathname,
        search,
        businesses,
      });

  return (
    <>
      <BusinessSelector
        businesses={businesses}
        selectedBusinessId={selectedBusinessId}
        pathname={pathname}
        search={search}
        loadFailed={businessesLoadFailed}
        onNavigate={onNavigate}
      />
      <AppNavigation
        role={role}
        businessId={selectedBusinessId}
        onNavigate={onNavigate}
      />
    </>
  );
}
