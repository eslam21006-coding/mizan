import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { getAuthContext } from "@/lib/auth/context";
import { safeLocalPath } from "@/lib/auth/redirect";
import styles from "@/components/auth-card.module.css";
import { login } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

const errorMessages: Record<string, string> = {
  invalid: "تعذر تسجيل الدخول. تأكد من البريد الإلكتروني وكلمة المرور.",
  "not-invited": "هذا الحساب غير مصرح له بالدخول إلى ميزان.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const auth = await getAuthContext();
  if (auth) {
    redirect("/");
  }

  const params = await searchParams;
  const next = safeLocalPath(params.next, "/");
  const errorMessage = params.error ? errorMessages[params.error] : null;

  return (
    <AuthCard
      eyebrow="تسجيل الدخول"
      title="مرحبًا بعودتك"
      description="ميزان متاح للحسابات التي تمت دعوتها فقط. استخدم البريد الإلكتروني وكلمة المرور الخاصة بحسابك."
    >
      {errorMessage && <div className={styles.error}>{errorMessage}</div>}
      <form action={login} className={styles.form}>
        <input type="hidden" name="next" value={next} />
        <div className={styles.field}>
          <label htmlFor="email">البريد الإلكتروني</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="password">كلمة المرور</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <button className={styles.submit} type="submit">
          دخول
        </button>
      </form>
      <p className={styles.secondary}>لا يوجد تسجيل حساب عام. إذا لم تصلك دعوة، تواصل مع مسؤول البرنامج.</p>
    </AuthCard>
  );
}
