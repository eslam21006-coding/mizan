import { Children, type ReactNode } from "react";
import Link from "next/link";
import { resolveNavigationDestination } from "@/lib/navigation-hierarchy";
import {
  resolveReturnOrigin,
  type ReturnOriginContext,
  type ReturnOriginMetadata,
} from "@/lib/return-origin";
import styles from "./workflow-recovery.module.css";

type StructuredReturnProps = {
  origin: ReturnOriginMetadata;
  context: ReturnOriginContext;
  label: string;
};

/** Resolves a Return action only through the allow-listed structured origin model. */
function StructuredReturnLink({ origin, context, label }: StructuredReturnProps) {
  const href = resolveNavigationDestination(resolveReturnOrigin(origin, context));

  return (
    <Link className={styles.returnLink} href={href}>
      {label}
    </Link>
  );
}

type ReturnContextBannerProps = {
  purpose: string;
  origin: ReturnOriginMetadata;
  context: ReturnOriginContext;
  returnLabel?: string;
  ariaLabel?: string;
};

/** Explains a temporary workflow detour and provides a deterministic Return action. */
export function ReturnContextBanner({
  purpose,
  origin,
  context,
  returnLabel = "العودة إلى المهمة",
  ariaLabel = "سياق العودة",
}: ReturnContextBannerProps) {
  return (
    <section className={styles.returnBanner} aria-label={ariaLabel}>
      <div className={styles.returnCopy}>
        <span className={styles.kicker}>سياق المهمة</span>
        <p>أنت هنا لإكمال {purpose}</p>
      </div>
      <StructuredReturnLink origin={origin} context={context} label={returnLabel} />
    </section>
  );
}

type ErrorReturnProps =
  | {
      returnOrigin: ReturnOriginMetadata;
      returnContext: ReturnOriginContext;
      returnLabel?: string;
    }
  | {
      returnOrigin?: never;
      returnContext?: never;
      returnLabel?: never;
    };

type InPageErrorStateProps = {
  title: string;
  description: string;
  retryAction?: ReactNode;
  ariaLabel?: string;
} & ErrorReturnProps;

/** Replaces only a page content area with a standard recoverable error state. */
export function InPageErrorState({
  title,
  description,
  retryAction,
  ariaLabel = title,
  returnOrigin,
  returnContext,
  returnLabel = "العودة",
}: InPageErrorStateProps) {
  const retryChildren = Children.toArray(retryAction);

  return (
    <section className={styles.errorState} role="alert" aria-label={ariaLabel}>
      <div className={styles.errorIcon} aria-hidden="true">
        !
      </div>
      <div className={styles.errorCopy}>
        <span className={styles.kicker}>حدث خطأ</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {(retryChildren.length > 0 || (returnOrigin && returnContext)) && (
        <div className={styles.errorActions} aria-label="إجراءات معالجة الخطأ">
          {retryChildren.length > 0 && <div className={styles.retryAction}>{retryChildren}</div>}
          {returnOrigin && returnContext && (
            <StructuredReturnLink
              origin={returnOrigin}
              context={returnContext}
              label={returnLabel}
            />
          )}
        </div>
      )}
    </section>
  );
}
