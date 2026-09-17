import Link from "next/link";
import { resolveNavigationDestination } from "@/lib/navigation-hierarchy";
import styles from "./customer-review-notice.module.css";

type CustomerReviewNoticeProps = {
  businessId: string;
  issueCount: number | null;
  loadError?: boolean;
};

/** Surfaces Customer Economics review only when there is known or potentially hidden review work. */
export function CustomerReviewNotice({
  businessId,
  issueCount,
  loadError = false,
}: CustomerReviewNoticeProps) {
  if (!loadError && (issueCount ?? 0) <= 0) {
    return null;
  }

  const reviewHref = resolveNavigationDestination({
    route: "business-customer-review",
    businessId,
  });

  return (
    <section className={styles.notice} aria-label="مراجعة اقتصاديات العميل">
      <div className={styles.copy}>
        <span className={styles.eyebrow}>تحتاج انتباهك</span>
        <h2>{loadError ? "تعذر التحقق من حالة المراجعة" : "هناك ملاحظات تحتاج مراجعتك"}</h2>
        <p>
          {loadError
            ? "لم يستطع ميزان التأكد من حالة المراجعة الآن. افتح صفحة المراجعة حتى لا يتم اعتبار حالة غير معروفة نظيفة بالخطأ."
            : `${issueCount} ملاحظة في اقتصاديات العميل لم يستطع ميزان حسمها بأمان تلقائيًا.`}
        </p>
      </div>
      <Link className={styles.action} href={reviewHref}>
        فتح المراجعة
      </Link>
    </section>
  );
}
