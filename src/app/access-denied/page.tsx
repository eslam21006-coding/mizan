import { AuthCard } from "@/components/auth-card";
import styles from "@/components/auth-card.module.css";

export default function AccessDeniedPage() {
  return (
    <AuthCard
      eyebrow="صلاحية الدخول"
      title="الحساب غير مصرح له"
      description="هذا الحساب لا يحمل صلاحية Admin أو Mentee معتمدة داخل ميزان. تواصل مع مسؤول البرنامج إذا كنت تعتقد أن هذا خطأ."
    >
      <form action="/auth/signout" method="post" className={styles.form}>
        <button className={styles.submit} type="submit">
          تسجيل الخروج
        </button>
      </form>
    </AuthCard>
  );
}
