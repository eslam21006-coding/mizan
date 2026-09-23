import Link from "next/link";
import type { MenteeBusiness, MenteeRecord } from "@/lib/admin/mentee-directory";
import { resolveNavigationDestination } from "@/lib/navigation-hierarchy";
import styles from "./mentees.module.css";

const dateFormatter = new Intl.DateTimeFormat("ar-EG", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** Formats a stored account timestamp without inventing a date when the value is missing or invalid. */
function formatCreatedAt(value: string | null) {
  if (!value) return "غير متاح";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "غير متاح" : dateFormatter.format(date);
}

type MenteeAccountSummaryProps = {
  mentee: MenteeRecord;
};

/** Shows the selected Mentee as the parent context for child business navigation. */
export function MenteeAccountSummary({ mentee }: MenteeAccountSummaryProps) {
  return (
    <section className={styles.menteeCard} aria-labelledby="mentee-account-heading">
      <div className={styles.menteeHeader}>
        <div className={styles.menteeIdentity}>
          <span>حساب Mentee</span>
          <h2 id="mentee-account-heading" dir="ltr">
            {mentee.email ?? "بريد غير متاح"}
          </h2>
        </div>
        <div className={styles.menteeMeta}>
          <div>
            <span>البزنسات</span>
            <strong>{new Intl.NumberFormat("ar-EG").format(mentee.businesses.length)}</strong>
          </div>
          <div>
            <span>تاريخ إنشاء الحساب</span>
            <strong>{formatCreatedAt(mentee.createdAt)}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

type MenteeDirectoryCardsProps = {
  mentees: readonly MenteeRecord[];
  hrefForMentee?: (mentee: MenteeRecord) => string;
};

/** Renders Mentees as parent records with one primary action into each Mentee workspace. */
export function MenteeDirectoryCards({
  mentees,
  hrefForMentee = (mentee) =>
    resolveNavigationDestination({
      route: "admin-mentee",
      menteeUserId: mentee.userId,
    }),
}: MenteeDirectoryCardsProps) {
  return (
    <section className={styles.menteeList} aria-label="قائمة المتدربين">
      {mentees.map((mentee) => {
        const headingId = `mentee-${mentee.userId}`;
        return (
          <article
            className={styles.menteeCard}
            key={mentee.userId}
            aria-labelledby={headingId}
          >
            <div className={styles.menteeHeader}>
              <div className={styles.menteeIdentity}>
                <span>حساب Mentee</span>
                <h2 id={headingId} dir="ltr">
                  {mentee.email ?? "بريد غير متاح"}
                </h2>
              </div>
              <div className={styles.menteeMeta}>
                <div>
                  <span>البزنسات</span>
                  <strong>{new Intl.NumberFormat("ar-EG").format(mentee.businesses.length)}</strong>
                </div>
                <div>
                  <span>تاريخ إنشاء الحساب</span>
                  <strong>{formatCreatedAt(mentee.createdAt)}</strong>
                </div>
              </div>
            </div>

            <div className={styles.menteeActions}>
              <Link className={styles.primaryAction} href={hrefForMentee(mentee)}>
                فتح المتدرب
              </Link>
              <span>افتح المتدرب أولًا ثم اختر البزنس المطلوب من صفحته.</span>
            </div>
          </article>
        );
      })}
    </section>
  );
}

type MenteeBusinessGridProps = {
  businesses: readonly MenteeBusiness[];
  hrefForBusiness?: (business: MenteeBusiness) => string;
};

/** Renders businesses only as children of the currently selected Mentee. */
export function MenteeBusinessGrid({
  businesses,
  hrefForBusiness = (business) =>
    resolveNavigationDestination({
      route: "business-overview",
      businessId: business.id,
    }),
}: MenteeBusinessGridProps) {
  return (
    <section className={styles.businessSection} aria-labelledby="mentee-businesses-heading">
      <div className={styles.sectionTitle}>
        <strong id="mentee-businesses-heading">بزنسات المتدرب</strong>
        <span>{new Intl.NumberFormat("ar-EG").format(businesses.length)}</span>
      </div>

      {businesses.length === 0 ? (
        <div className={styles.noBusiness}>لم يُنشئ هذا المتدرب أي بزنس حتى الآن.</div>
      ) : (
        <div className={styles.businessGrid}>
          {businesses.map((business) => (
            <article className={styles.businessCard} key={business.id}>
              <div>
                <strong>{business.name}</strong>
                <span>
                  {business.baseCurrency} · {business.timezone}
                </span>
              </div>
              <Link className={styles.businessOpenAction} href={hrefForBusiness(business)}>
                فتح البزنس
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
