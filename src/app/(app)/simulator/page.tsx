import { EmptyModule } from "@/components/empty-module";
import { PageHeading } from "@/components/page-heading";

export default function Page() {
  return (
    <div className="page-stack">
      <PageHeading
        title="المحاكي"
        description="اختبر سيناريوهات مالية منفصلة تمامًا عن البيانات التاريخية الفعلية."
      />
      <EmptyModule
        title="السيناريوهات"
        description="هذه المساحة جاهزة داخل هيكل التطبيق، وسيتم تفعيل وظائفها في المهمة المخصصة لها."
      />
    </div>
  );
}
