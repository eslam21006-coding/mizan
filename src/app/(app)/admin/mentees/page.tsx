import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { requireFreshAdmin } from "@/lib/auth/context";
import styles from "./mentees.module.css";

type MenteeDirectoryRow = {
  mentee_user_id: string;
  mentee_email: string | null;
  mentee_created_at: string | null;
  business_id: string | null;
  business_name: string | null;
  base_currency: string | null;
  timezone: string | null;
};

type MenteeBusiness = {
  id: string;
  name: string;
  baseCurrency: string;
  timezone: string;
};

type MenteeRecord = {
  userId: string;
  email: string | null;
  createdAt: string | null;
  businesses: MenteeBusiness[];
};

const dateFormatter = new Intl.DateTimeFormat("ar-EG", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function groupDirectoryRows(rows: readonly MenteeDirectoryRow[]) {
  const mentees = new Map<string, MenteeRecord>();

  for (const row of rows) {
    const existing = mentees.get(row.mentee_user_id) ?? {
      userId: row.mentee_user_id,
      email: row.mentee_email,
      createdAt: row.mentee_created_at,
      businesses: [],
    };

    if (row.business_id && row.business_name && row.base_currency && row.timezone) {
      existing.businesses.push({
        id: row.business_id,
        name: row.business_name,
        baseCurrency: row.base_currency,
        timezone: row.timezone,
      });
    }

    mentees.set(row.mentee_user_id, existing);
  }

  return [...mentees.values()];
}

function formatCreatedAt(value: string | null) {
  if (!value) return "غير متاح";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "غير متاح" : dateFormatter.format(date);
}

export default async function AdminMenteesPage() {
  const { supabase } = await requireFreshAdmin();
  const { data, error } = await supabase.rpc("admin_mentee_directory");
  const mentees = groupDirectoryRows((data ?? []) as MenteeDirectoryRow[]);
  const businessCount = mentees.reduce((total, mentee) => total + mentee.businesses.length, 0);

  return (
    <div className="page-stack">
      <div className={styles.headingRow}>
        <PageHeading
          title="المتدربون"
          description="إدارة حسابات المتدربين والوصول إلى البزنسات التي يملكونها من مكان واحد."
        />
        <Link className={styles.inviteButton} href="/admin/invites">
          دعوة متدرب جديد
        </Link>
      </div>

      {error ? (
        <section className={styles.errorPanel} role="alert">
          <strong>تعذر تحميل قائمة المتدربين</strong>
          <p>لم يتم عرض أي بيانات حسابات. أعد المحاولة بعد التأكد من اتصال قاعدة البيانات.</p>
        </section>
      ) : (
        <>
          <section className={styles.summaryGrid} aria-label="ملخص المتدربين">
            <article>
              <span>إجمالي المتدربين</span>
              <strong>{new Intl.NumberFormat("ar-EG").format(mentees.length)}</strong>
            </article>
            <article>
              <span>إجمالي البزنسات</span>
              <strong>{new Intl.NumberFormat("ar-EG").format(businessCount)}</strong>
            </article>
            <article>
              <span>بدون بزنس بعد</span>
              <strong>
                {new Intl.NumberFormat("ar-EG").format(
                  mentees.filter((mentee) => mentee.businesses.length === 0).length,
                )}
              </strong>
            </article>
          </section>

          {mentees.length === 0 ? (
            <section className={styles.emptyState}>
              <span>لا يوجد متدربون حتى الآن</span>
              <h2>ابدأ بإرسال أول دعوة</h2>
              <p>أي حساب Mentee جديد يظهر هنا بعد إنشائه من دعوة Admin.</p>
              <Link className={styles.primaryAction} href="/admin/invites">
                فتح الدعوات
              </Link>
            </section>
          ) : (
            <section className={styles.menteeList} aria-label="قائمة المتدربين">
              {mentees.map((mentee) => (
                <article className={styles.menteeCard} key={mentee.userId}>
                  <div className={styles.menteeHeader}>
                    <div>
                      <span>حساب Mentee</span>
                      <h2 dir="ltr">{mentee.email ?? "بريد غير متاح"}</h2>
                    </div>
                    <div className={styles.joinedAt}>
                      <span>تاريخ إنشاء الحساب</span>
                      <strong>{formatCreatedAt(mentee.createdAt)}</strong>
                    </div>
                  </div>

                  <div className={styles.businessSection}>
                    <div className={styles.sectionTitle}>
                      <strong>البزنسات</strong>
                      <span>{new Intl.NumberFormat("ar-EG").format(mentee.businesses.length)}</span>
                    </div>

                    {mentee.businesses.length === 0 ? (
                      <p className={styles.noBusiness}>لم يُنشئ هذا المتدرب أي بزنس حتى الآن.</p>
                    ) : (
                      <div className={styles.businessGrid}>
                        {mentee.businesses.map((business) => (
                          <Link
                            className={styles.businessCard}
                            href={`/?business=${encodeURIComponent(business.id)}`}
                            key={business.id}
                          >
                            <div>
                              <strong>{business.name}</strong>
                              <span>{business.baseCurrency}</span>
                            </div>
                            <small>فتح البزنس ←</small>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
