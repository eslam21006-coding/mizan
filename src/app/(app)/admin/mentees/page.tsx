import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import {
  groupMenteeDirectoryRows,
  type MenteeDirectoryRow,
} from "@/lib/admin/mentee-directory";
import { requireFreshAdmin } from "@/lib/auth/context";
import { resolveNavigationDestination } from "@/lib/navigation-hierarchy";
import styles from "./mentees.module.css";

const dateFormatter = new Intl.DateTimeFormat("ar-EG", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatCreatedAt(value: string | null) {
  if (!value) return "غير متاح";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "غير متاح" : dateFormatter.format(date);
}

export default async function AdminMenteesPage() {
  const { supabase } = await requireFreshAdmin();
  const { data, error } = await supabase.rpc("admin_mentee_directory");
  const mentees = groupMenteeDirectoryRows((data ?? []) as MenteeDirectoryRow[]);
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
                        <h2 id={headingId} dir="ltr">{mentee.email ?? "بريد غير متاح"}</h2>
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
                      <Link
                        className={styles.primaryAction}
                        href={resolveNavigationDestination({
                          route: "admin-mentee",
                          menteeUserId: mentee.userId,
                        })}
                      >
                        فتح المتدرب
                      </Link>
                      <span>
                        افتح المتدرب أولًا ثم اختر البزنس المطلوب من صفحته.
                      </span>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </>
      )}
    </div>
  );
}
