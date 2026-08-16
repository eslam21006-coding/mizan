import { EmptyModule } from "@/components/empty-module";
import { PageHeading } from "@/components/page-heading";

export default function Page() {
  return (
    <div className="page-stack">
      <PageHeading
        title="خطة الوصول للهدف"
        description="حوّل هدف الإيراد أو الربح أو الهامش إلى المتطلبات التشغيلية اللازمة."
      />
      <EmptyModule
        title="خطة الهدف"
        description="هذه المساحة جاهزة داخل هيكل التطبيق، وسيتم تفعيل وظائفها في المهمة المخصصة لها."
      />
    </div>
  );
}
