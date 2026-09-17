import Link from "next/link";
import type { BackNavigation, BreadcrumbItem } from "@/lib/navigation-hierarchy";
import { resolveNavigationDestination } from "@/lib/navigation-hierarchy";
import styles from "./navigation-hierarchy.module.css";

type BreadcrumbProps = {
  items: readonly BreadcrumbItem[];
  ariaLabel?: string;
};

/** Creates a stable key from a breadcrumb's semantic destination or current-page label. */
function breadcrumbItemKey(item: BreadcrumbItem) {
  if (item.current) {
    return `current:${item.label}`;
  }

  return `${resolveNavigationDestination(item.destination)}:${item.label}`;
}

/** Renders an accessible hierarchical breadcrumb from structured navigation metadata. */
export function Breadcrumb({ items, ariaLabel = "مسار التنقل" }: BreadcrumbProps) {
  return (
    <nav className={styles.breadcrumbNav} aria-label={ariaLabel}>
      <ol className={styles.breadcrumbList}>
        {items.map((item, index) => (
          <li className={styles.breadcrumbItem} key={breadcrumbItemKey(item)}>
            {index > 0 && (
              <span className={styles.separator} aria-hidden="true">
                /
              </span>
            )}
            {item.current ? (
              <span className={styles.current} aria-current="page">
                {item.label}
              </span>
            ) : (
              <Link
                className={styles.breadcrumbLink}
                href={resolveNavigationDestination(item.destination)}
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

type BackLinkProps = BackNavigation & {
  className?: string;
};

/** Renders a deterministic link to an explicitly declared hierarchical parent. */
export function BackLink({ label, destination, className }: BackLinkProps) {
  const classes = className ? `${styles.backLink} ${className}` : styles.backLink;

  return (
    <Link className={classes} href={resolveNavigationDestination(destination)}>
      <span className={styles.backIcon} aria-hidden="true">
        →
      </span>
      <span>{label}</span>
    </Link>
  );
}
