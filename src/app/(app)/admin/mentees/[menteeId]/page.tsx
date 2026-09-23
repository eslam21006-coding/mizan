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
import { MenteeAccountSummary, MenteeBusinessGrid } from "../mentee-hierarchy";
import styles from "../mentees.module.css";

type AdminMenteePageProps = {
  params: Promise<{ menteeId: string }>;
};

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

      <MenteeAccountSummary mentee={mentee} />

      <MenteeBusinessGrid businesses={mentee.businesses} />
    </div>
  );
}
