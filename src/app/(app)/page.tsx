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
          <span className="status-pill">الهيكل جاهز</span>
          <h2>كل أرقام البزنس في سياق واحد</h2>
          <p>
            بعد إعداد البزنس وإضافة البيانات، ستظهر هنا المؤشرات الأساسية والتحليلات التي تساعدك
            على فهم الربحية والتكلفة وقيمة العميل.
          </p>
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
          <h3>لا توجد بيانات بعد</h3>
          <p>ستظهر مقارنة الشهر الحالي بالفترة السابقة بعد تفعيل إدخال البيانات.</p>
        </section>
        <section className="shell-card">
          <span className="shell-card-kicker">جودة البيانات</span>
          <h3>في انتظار إعداد البزنس</h3>
          <p>ميزان لن يستنتج نتائج مالية قبل توفر المدخلات اللازمة للحكم.</p>
        </section>
      </div>
    </div>
  );
}
