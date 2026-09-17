import type { ReactNode } from "react";
import { PageHeading } from "./page-heading";
import styles from "./page-header.module.css";

export type PageActionState = "normal" | "loading" | "read-only" | "error";

type PageActionSlotProps = {
  state?: PageActionState;
  children?: ReactNode;
  ariaLabel?: string;
};

const ACTION_STATE_COPY: Record<PageActionState, string> = {
  normal: "لا يوجد إجراء مطلوب الآن",
  loading: "جارٍ تحميل الإجراءات…",
  "read-only": "عرض فقط",
  error: "تعذر تحميل الإجراءات",
};

/** Keeps the page-action region structurally stable across normal and exceptional UI states. */
export function PageActionSlot({
  state = "normal",
  children,
  ariaLabel = "إجراءات الصفحة",
}: PageActionSlotProps) {
  return (
    <div className={styles.actionSlot} data-action-state={state} aria-label={ariaLabel}>
      <div className={styles.actionContent}>
        {children ?? (
          <span className={styles.actionStateCopy} role="status">
            {ACTION_STATE_COPY[state]}
          </span>
        )}
      </div>
    </div>
  );
}

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  actionState?: PageActionState;
  actionsAriaLabel?: string;
};

/** Composes the standard page heading with a predictable action region. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  actionState = "normal",
  actionsAriaLabel,
}: PageHeaderProps) {
  return (
    <div className={styles.pageHeader}>
      <PageHeading eyebrow={eyebrow} title={title} description={description} />
      <PageActionSlot state={actionState} ariaLabel={actionsAriaLabel}>
        {actions}
      </PageActionSlot>
    </div>
  );
}
