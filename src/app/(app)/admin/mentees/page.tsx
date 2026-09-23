import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import {
  groupMenteeDirectoryRows,
  type MenteeDirectoryRow,
} from "@/lib/admin/mentee-directory";
import { requireFreshAdmin } from "@/lib/auth/context";
import { MenteeDirectoryCards } from "./mentee-hierarchy";
import styles from "./mentees.module.css";

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
            <MenteeDirectoryCards mentees={mentees} />
          )}
        </>
      )}
    </div>
  );
}
