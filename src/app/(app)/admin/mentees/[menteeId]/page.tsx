import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink, Breadcrumb } from "@/components/navigation-hierarchy";
import { PageHeading } from "@/components/page-heading";
import {
  findMenteeRecord,
  type MenteeDirectoryRow,
} from "@/lib/admin/mentee-directory";
import { requireFreshAdmin } from "@/lib/auth/context";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { resolveNavigationDestination } from "@/lib/navigation-hierarchy";
import styles from "../mentees.module.css";

type AdminMenteePageProps = {
  params: Promise<{ menteeId: string }>;
};

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

/** Renders one Mentee as the parent context before exposing that Mentee's businesses. */
export default async function AdminMenteePage({ params }: AdminMenteePageProps) {
  const { menteeId: rawMenteeId } = await params;
  const menteeId = parseResourceId(rawMenteeId);
  if (!menteeId) notFound();

  const { supabase } = await requireFreshAdmin();
  const { data, error } = await supabase.rpc("admin_mentee_directory");
  if (error) {
    return (
      <div className="page-stack">
        <BackLink
          label="العودة إلى المتدربين"
          destination={{ route: "admin-mentees" }}
        />
        <PageHeading
          title="تفاصيل المتدرب"
          description="اعرض بزنسات المتدرب من سياق إداري واضح."
        />
        <section className={styles.errorPanel} role="alert">
          <strong>تعذر تحميل بيانات المتدرب</strong>
          <p>لم يتم عرض أي بزنس حتى لا نعتمد على بيانات غير مؤكدة.</p>
        </section>
      </div>
    );
  }

  const mentee = findMenteeRecord((data ?? []) as MenteeDirectoryRow[], menteeId);
  if (!mentee) notFound();

  const displayEmail = mentee.email ?? "بريد غير متاح";

  return (
    <div className="page-stack">
      <Breadcrumb
        items={[
          {
            label: "المتدربون",
            destination: { route: "admin-mentees" },
          },
          { label: displayEmail, current: true },
        ]}
        ariaLabel="مسار إدارة المتدرب"
      />

      <BackLink
        label="العودة إلى المتدربين"
        destination={{ route: "admin-mentees" }}
      />

      <div className={styles.headingRow}>
        <PageHeading
          title="تفاصيل المتدرب"
          description="اختر بزنسًا تابعًا لهذا المتدرب للدخول إليه من السياق الإداري."
        />
        <Link className={styles.inviteButton} href="/admin/invites">
          دعوة متدرب جديد
        </Link>
      </div>

      <section className={styles.menteeCard} aria-labelledby="mentee-account-heading">
        <div className={styles.menteeHeader}>
          <div className={styles.menteeIdentity}>
            <span>حساب Mentee</span>
            <h2 id="mentee-account-heading" dir="ltr">{displayEmail}</h2>
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

      <section className={styles.businessSection} aria-labelledby="mentee-businesses-heading">
        <div className={styles.sectionTitle}>
          <strong id="mentee-businesses-heading">بزنسات المتدرب</strong>
          <span>{new Intl.NumberFormat("ar-EG").format(mentee.businesses.length)}</span>
        </div>

        {mentee.businesses.length === 0 ? (
          <div className={styles.noBusiness}>
            لم يُنشئ هذا المتدرب أي بزنس حتى الآن.
          </div>
        ) : (
          <div className={styles.businessGrid}>
            {mentee.businesses.map((business) => (
              <article className={styles.businessCard} key={business.id}>
                <div>
                  <strong>{business.name}</strong>
                  <span>{business.baseCurrency} · {business.timezone}</span>
                </div>
                <Link
                  className={styles.businessOpenAction}
                  href={resolveNavigationDestination({
                    route: "business-overview",
                    businessId: business.id,
                  })}
                >
                  فتح البزنس
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
