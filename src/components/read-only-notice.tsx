import styles from "./read-only-notice.module.css";

type ReadOnlyNoticeProps = {
  description?: string;
  title?: string;
  ariaLabel?: string;
};

/** Keeps view-only permissions explicit without removing page structure or implying an error state. */
export function ReadOnlyNotice({
  title = "عرض فقط",
  description = "يمكنك مراجعة البيانات، لكن التعديل متاح لمالك البزنس أو الأدمن.",
  ariaLabel = "حالة صلاحية العرض فقط",
}: ReadOnlyNoticeProps) {
  return (
    <section className={styles.notice} aria-label={ariaLabel}>
      <span className={styles.badge}>{title}</span>
      <p>{description}</p>
    </section>
  );
}
