import { PageHeading } from "@/components/page-heading";
import { requireFreshAdmin } from "@/lib/auth/context";
import { inviteMentee } from "./actions";
import styles from "./invites.module.css";

type InvitePageProps = {
  searchParams: Promise<{ status?: string }>;
};

const errorMessages: Record<string, string> = {
  "invalid-email": "أدخل بريدًا إلكترونيًا صالحًا.",
  "invite-failed": "تعذر إرسال الدعوة. قد يكون الحساب موجودًا بالفعل أو حدث خطأ في خدمة الدعوات.",
  "role-failed": "تم إلغاء الحساب لأن تعيين صلاحية Mentee لم يكتمل. حاول مرة أخرى.",
  "cleanup-failed":
    "فشل تعيين صلاحية Mentee وتعذر حذف الحساب الذي تم إنشاؤه. راجع Supabase Auth قبل إعادة المحاولة.",
};

export default async function AdminInvitesPage({ searchParams }: InvitePageProps) {
  await requireFreshAdmin();
  const params = await searchParams;
  const errorMessage = params.status ? errorMessages[params.status] : null;

  return (
    <div className="page-stack">
      <PageHeading
        title="دعوة المتدربين"
        description="أرسل دعوة لحساب Mentee جديد. لا يمكن إنشاء حساب في ميزان بدون دعوة من Admin."
      />
      <section className={styles.panel}>
        <strong>دعوة Mentee</strong>
        <p className={styles.help}>
          الدعوة تنشئ الحساب بصلاحية Mentee من جهة السيرفر، ثم يختار المتدرب كلمة المرور من رابط الدعوة.
        </p>
        {params.status === "sent" && <div className={styles.notice}>تم إرسال الدعوة بنجاح.</div>}
        {errorMessage && <div className={styles.error}>{errorMessage}</div>}
        <form action={inviteMentee} className={styles.form}>
          <input
            className={styles.input}
            type="email"
            name="email"
            aria-label="البريد الإلكتروني للمتدرب"
            placeholder="name@example.com"
            autoComplete="off"
            required
          />
          <button className={styles.button} type="submit">
            إرسال الدعوة
          </button>
        </form>
      </section>
    </div>
  );
}
