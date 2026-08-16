import { EmptyModule } from "@/components/empty-module";
import { PageHeading } from "@/components/page-heading";

export default function Page() {
  return (
    <div className="page-stack">
      <PageHeading
        title="الأرقام الشهرية"
        description="أدخل وراجع الأداء المالي لكل شهر مع الحفاظ على تاريخ البزنس."
      />
      <EmptyModule
        title="البيانات الشهرية"
        description="هذه المساحة جاهزة داخل هيكل التطبيق، وسيتم تفعيل وظائفها في المهمة المخصصة لها."
      />
    </div>
  );
}
