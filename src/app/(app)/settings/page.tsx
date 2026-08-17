import { EmptyModule } from "@/components/empty-module";
import { PageHeading } from "@/components/page-heading";

export default function Page() {
  return (
    <div className="page-stack">
      <PageHeading
        title="الإعدادات"
        description="إدارة إعدادات البزنس الأساسية والعملة والمنطقة الزمنية من مكان واحد."
      />
      <EmptyModule
        title="إعدادات البزنس"
        description="هذه المساحة جاهزة داخل هيكل التطبيق، وسيتم تفعيل وظائفها في المهمة المخصصة لها."
      />
    </div>
  );
}
