"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MizanRole } from "@/lib/auth/role";
import {
  resolveBusinessAwareNavigationHref,
} from "@/lib/business-shell-context";
import {
  getSimplifiedNavigation,
  isNavigationItemActive,
  type NavigationItem,
} from "@/lib/navigation";
import { NavIcon } from "./nav-icon";

type AppNavigationProps = {
  role: MizanRole;
  businessId: string | null;
  onNavigate?: () => void;
};

type NavigationGroupProps = {
  items: readonly NavigationItem[];
  label: string;
  className: string;
  pathname: string;
  businessId: string | null;
  onNavigate?: () => void;
  visibleLabel?: string;
};

/** Renders one semantic navigation list with shared active-state behavior. */
function NavigationGroup({
  items,
  label,
  className,
  pathname,
  businessId,
  onNavigate,
  visibleLabel,
}: NavigationGroupProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={`app-navigation-section ${className}`}>
      {visibleLabel ? <span className="nav-section-label">{visibleLabel}</span> : null}
      <ul className="app-navigation-list" aria-label={label}>
        {items.map((item) => {
          const isActive = isNavigationItemActive(item, pathname);

          const href = resolveBusinessAwareNavigationHref(item.href, businessId);

          return (
            <li key={item.href} className="app-navigation-list-item">
              <Link
                href={href}
                className={isActive ? "nav-item nav-item-active" : "nav-item"}
                aria-current={isActive ? "page" : undefined}
                onClick={onNavigate}
              >
                <span className="nav-icon">
                  <NavIcon name={item.icon} />
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Renders the role-aware simplified navigation used by desktop and mobile shells. */
export function AppNavigation({ role, businessId, onNavigate }: AppNavigationProps) {
  const pathname = usePathname();
  const navigation = getSimplifiedNavigation(role);

  return (
    <nav className="app-navigation" aria-label="التنقل الرئيسي">
      <NavigationGroup
        items={navigation.primary}
        label="الأقسام الرئيسية"
        className="app-navigation-primary"
        pathname={pathname}
        businessId={businessId}
        onNavigate={onNavigate}
      />
      <NavigationGroup
        items={navigation.secondary}
        label="روابط إضافية"
        className="app-navigation-secondary"
        pathname={pathname}
        businessId={businessId}
        onNavigate={onNavigate}
      />
      <NavigationGroup
        items={navigation.admin}
        label="الإدارة"
        className="app-navigation-admin"
        pathname={pathname}
        businessId={businessId}
        onNavigate={onNavigate}
        visibleLabel="الإدارة"
      />
    </nav>
  );
}
