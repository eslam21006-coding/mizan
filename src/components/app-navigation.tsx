"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { menteeNavigation } from "@/lib/navigation";
import { NavIcon } from "./nav-icon";

type AppNavigationProps = {
  onNavigate?: () => void;
};

export function AppNavigation({ onNavigate }: AppNavigationProps) {
  const pathname = usePathname();

  return (
    <nav className="app-navigation" aria-label="التنقل الرئيسي">
      {menteeNavigation.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

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
    </nav>
  );
}
