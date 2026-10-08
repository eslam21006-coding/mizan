"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MizanRole } from "@/lib/auth/role";
import {
  getSimplifiedNavigation,
  isNavigationItemActive,
  type NavigationItem,
} from "@/lib/navigation";
import { NavIcon } from "./nav-icon";

type AppNavigationProps = {
  role: MizanRole;
  onNavigate?: () => void;
};

type NavigationGroupProps = {
  items: readonly NavigationItem[];
  label: string;
  className: string;
  pathname: string;
  onNavigate?: () => void;
  visibleLabel?: string;
};

function NavigationGroup({
  items,
  label,
  className,
  pathname,
  onNavigate,
  visibleLabel,
}: NavigationGroupProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={`app-navigation-section ${className}`} role="group" aria-label={label}>
      {visibleLabel ? <span className="nav-section-label">{visibleLabel}</span> : null}
      {items.map((item) => {
        const isActive = isNavigationItemActive(item, pathname);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={isActive ? "nav-item nav-item-active" : "nav-item"}
            aria-current={isActive ? "page" : undefined}
            onClick={onNavigate}
          >
            <span className="nav-icon">
              <NavIcon name={item.icon} />
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function AppNavigation({ role, onNavigate }: AppNavigationProps) {
  const pathname = usePathname();
  const navigation = getSimplifiedNavigation(role);

  return (
    <nav className="app-navigation" aria-label="التنقل الرئيسي">
      <NavigationGroup
        items={navigation.primary}
        label="الأقسام الرئيسية"
        className="app-navigation-primary"
        pathname={pathname}
        onNavigate={onNavigate}
      />
      <NavigationGroup
        items={navigation.secondary}
        label="روابط إضافية"
        className="app-navigation-secondary"
        pathname={pathname}
        onNavigate={onNavigate}
      />
      <NavigationGroup
        items={navigation.admin}
        label="الإدارة"
        className="app-navigation-admin"
        pathname={pathname}
        onNavigate={onNavigate}
        visibleLabel="الإدارة"
      />
    </nav>
  );
}
