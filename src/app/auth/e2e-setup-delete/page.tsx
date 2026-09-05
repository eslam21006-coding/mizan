import { notFound } from "next/navigation";
import { connection } from "next/server";
import expenseStyles from "@/app/(app)/businesses/[businessId]/expenses/expenses.module.css";
import revenueStyles from "@/app/(app)/businesses/[businessId]/revenue-streams/revenue-streams.module.css";
import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

export default async function SetupDeleteE2eFixturePage() {
  await connection();
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  return (
    <AppShell {...fixtureShellProps}>
      <div className="page-stack">
        <div>
          <span className="eyebrow">اختبار إدارة الهيكل</span>
          <h1>حذف البنود غير المستخدمة</h1>
          <p className="muted-copy">
            واجهة معزولة للتحقق من وضوح إجراء الحذف واتجاه RTL والاستجابة قبل دمجه في صفحات الإعداد.
          </p>
        </div>

        <section className={revenueStyles.panel}>
          <div className={revenueStyles.panelHeading}>
            <div>
              <span className={revenueStyles.kicker}>مصادر الإيراد</span>
              <h2>Agency</h2>
            </div>
          </div>
          <article className={revenueStyles.streamCard}>
            <div className={revenueStyles.streamTopline}>
              <strong>Agency</strong>
              <div>
                <span className={revenueStyles.activeBadge}>نشط</span>
                <span className={revenueStyles.typeBadge}>Backend</span>
              </div>
            </div>
            <div className={revenueStyles.deleteRow}>
              <p>الحذف متاح فقط إذا لم يُستخدم هذا المصدر في أي بيانات شهرية أو معاملات عملاء.</p>
              <form action="?attempt=revenue-delete">
                <ConfirmSubmitButton
                  className={revenueStyles.deleteButton}
                  ariaLabel="حذف مصدر الإيراد Agency"
                  confirmMessage="هل تريد حذف مصدر الإيراد «Agency»؟ لا يمكن التراجع عن حذف مصدر غير مستخدم."
                >
                  حذف المصدر
                </ConfirmSubmitButton>
              </form>
            </div>
          </article>
        </section>

        <section className={expenseStyles.panel}>
          <div className={expenseStyles.panelHeading}>
            <div>
              <span className={expenseStyles.kicker}>هيكل المصروفات</span>
              <h2>رواتب</h2>
            </div>
          </div>
          <article className={expenseStyles.expenseCard}>
            <div className={expenseStyles.expenseTopline}>
              <strong>رواتب</strong>
              <div>
                <span className={expenseStyles.activeBadge}>نشط</span>
                <span className={expenseStyles.categoryBadge}>المصاريف التشغيلية العامة</span>
                <span className={expenseStyles.behaviorBadge}>ثابت شهريًا</span>
              </div>
            </div>
            <div className={expenseStyles.deleteRow}>
              <p>الحذف متاح فقط إذا لم يُستخدم هذا البند في أي بيانات شهرية أو تخصيصات سابقة.</p>
              <form action="?attempt=expense-delete">
                <ConfirmSubmitButton
                  className={expenseStyles.deleteButton}
                  ariaLabel="حذف المصروف رواتب"
                  confirmMessage="هل تريد حذف المصروف «رواتب»؟ لا يمكن التراجع عن حذف بند غير مستخدم."
                >
                  حذف المصروف
                </ConfirmSubmitButton>
              </form>
            </div>
          </article>
        </section>
      </div>
    </AppShell>
  );
}
