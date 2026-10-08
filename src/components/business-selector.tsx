"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  manageBusinessesHref,
  resolveBusinessSwitchHref,
  resolveShellBusinessId,
  type ShellBusiness,
} from "@/lib/business-shell-context";
import styles from "./app-shell.module.css";

type BusinessSelectorProps = {
  businesses: readonly ShellBusiness[];
  onNavigate?: () => void;
};

/** Renders the persistent shell business selector without introducing new persisted state. */
export function BusinessSelector({ businesses, onNavigate }: BusinessSelectorProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const search = searchParams.toString();
  const selectedBusinessId = resolveShellBusinessId({
    pathname,
    search,
    businesses,
  });

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
      {businesses.length > 0 ? (
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
