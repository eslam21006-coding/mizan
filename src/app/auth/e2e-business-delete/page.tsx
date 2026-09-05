import { notFound } from "next/navigation";
import { connection } from "next/server";
import { BusinessDeleteForm } from "@/app/(app)/settings/businesses/[businessId]/delete/business-delete-form";
import styles from "@/app/(app)/settings/businesses/[businessId]/delete/business-delete.module.css";
import { AppShell } from "@/components/app-shell";

const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

export default async function BusinessDeleteE2eFixturePage() {
  await connection();
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  return (
    <AppShell {...fixtureShellProps}>
      <div className={styles.page}>
        <section className={styles.dangerCard} aria-labelledby="delete-business-title">
          <span className={styles.dangerBadge}>منطقة خطرة</span>
          <h1 id="delete-business-title">حذف Mizan Founder Test</h1>
          <p className={styles.warningCopy} id="business-delete-warning">
            هذا إجراء دائم. ميزان لن ينفذ الحذف إلا بعد كتابة كلمة التأكيد، كما أن قاعدة البيانات
            ستمنع العملية تلقائيًا إذا كان هناك تاريخ أو بيانات مرتبطة محمية من الحذف.
          </p>
          <div className={styles.warningList}>
            <div>
              <strong>التأكيد اليدوي مطلوب:</strong> اكتب «حذف» أو «Delete» قبل أن يصبح زر الحذف متاحًا.
            </div>
            <div>
              <strong>حماية التاريخ:</strong> وجود بيانات محمية قد يمنع حذف البزنس حتى بعد التأكيد.
            </div>
          </div>
          <BusinessDeleteForm
            businessId="b7000000-0000-4000-8000-000000000099"
            businessName="Mizan Founder Test"
          />
        </section>
      </div>
    </AppShell>
  );
}
