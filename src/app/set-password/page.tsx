import { AuthCard } from "@/components/auth-card";
import styles from "@/components/auth-card.module.css";
import { requireAuthContext } from "@/lib/auth/context";
import { setPassword } from "./actions";

type SetPasswordPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SetPasswordPage({ searchParams }: SetPasswordPageProps) {
  await requireAuthContext();
  const { error } = await searchParams;

  return (
    <AuthCard
      eyebrow="تفعيل الدعوة"
      title="اختر كلمة المرور"
      description="استخدم كلمة مرور لا تقل عن 12 حرفًا. بعد الحفظ ستدخل إلى حساب ميزان مباشرة."
    >
      {error && (
        <div className={styles.error}>
          {error === "invalid"
            ? "تأكد أن كلمتي المرور متطابقتان وأن الطول بين 12 و128 حرفًا."
            : "تعذر تحديث كلمة المرور. حاول مرة أخرى."}
        </div>
      )}
      <form action={setPassword} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="password">كلمة المرور الجديدة</label>
          <input
            id="password"
            name="password"
            type="password"
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="confirmation">تأكيد كلمة المرور</label>
          <input
            id="confirmation"
            name="confirmation"
            type="password"
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            required
          />
        </div>
        <button className={styles.submit} type="submit">
          تفعيل الحساب
        </button>
      </form>
    </AuthCard>
  );
}
