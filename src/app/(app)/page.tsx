import Link from "next/link";
import { PageHeading } from "@/components/page-heading";

export default function HomePage() {
  return (
    <div className="page-stack">
      <PageHeading
        title="الرئيسية"
        description="مساحتك المركزية لفهم اقتصاديات البزنس واتخاذ قرارات مالية أوضح."
      />

      <section className="welcome-panel">
        <div className="welcome-copy">
          <span className="status-pill">ابدأ بإعداد البزنس</span>
          <h2>كل أرقام البزنس في سياق واحد</h2>
          <p>
            الخطوة الأولى هي إضافة البزنس وتحديد العملة والمنطقة الزمنية. بعد ذلك سنبني مصادر
            الإيراد والمصروفات في خطوات مستقلة.
          </p>
          <Link className="primary-link" href="/businesses">
            إعداد البزنس
          </Link>
        </div>
        <section className="metric-preview" aria-label="معاينة المؤشرات">
          <div className="preview-metric">
            <span>هامش صافي الربح</span>
            <strong>—</strong>
          </div>
          <div className="preview-metric">
            <span>Ultimate CAC</span>
            <strong>—</strong>
          </div>
          <div className="preview-metric">
            <span>Observed LTV</span>
            <strong>—</strong>
          </div>
        </section>
      </section>

      <div className="shell-grid">
        <section className="shell-card">
          <span className="shell-card-kicker">الفترة الحالية</span>
          <h3>لا توجد بيانات شهرية بعد</h3>
          <p>إدخال الأرقام الشهرية له مرحلة مستقلة بعد اكتمال هيكل البزنس.</p>
        </section>
        <section className="shell-card">
          <span className="shell-card-kicker">إعداد البزنس</span>
          <h3>ابدأ بالمعلومات الأساسية</h3>
          <p>اسم البزنس والعملة والمنطقة الزمنية فقط؛ بدون أي افتراضات أو أرقام مالية.</p>
        </section>
      </div>
    </div>
  );
}
