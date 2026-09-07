import { notFound } from "next/navigation";
import { TransactionImportReviewGuide } from "@/app/(app)/businesses/[businessId]/customers/import/transaction-import-review-guide";

/** CI-only fixture for the review-versus-save guidance shown after transaction validation. */
export default function TransactionImportClarityE2eFixturePage() {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") notFound();

  return (
    <main className="page-stack" dir="rtl">
      <section aria-label="عناصر مسار الاستيراد للاختبار">
        <label htmlFor="transaction-file">ملف مصحح</label>
        <input id="transaction-file" type="file" />
        <h2 id="transaction-validation-title">راجع البيانات قبل الحفظ</h2>
      </section>
      <TransactionImportReviewGuide />
    </main>
  );
}
