import { EmptyModule } from "@/components/empty-module";
import { PageHeading } from "@/components/page-heading";

export default function Page() {
  return (
    <div className="page-stack">
      <PageHeading
        title="الفانلز"
        description="تابع أداء الفانلز اختياريًا مع بقاء اقتصاديات البزنس هي المرجع الأساسي."
      />
      <EmptyModule
        title="بيانات الفانلز"
        description="هذه المساحة جاهزة داخل هيكل التطبيق، وسيتم تفعيل وظائفها في المهمة المخصصة لها."
      />
    </div>
  );
}
