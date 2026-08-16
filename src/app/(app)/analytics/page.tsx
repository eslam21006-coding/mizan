import { EmptyModule } from "@/components/empty-module";
import { PageHeading } from "@/components/page-heading";

export default function Page() {
  return (
    <div className="page-stack">
      <PageHeading
        title="التحليلات"
        description="راجع الاتجاهات التاريخية والمقارنات دون الاعتماد على شهر واحد فقط."
      />
      <EmptyModule
        title="التحليلات التاريخية"
        description="هذه المساحة جاهزة داخل هيكل التطبيق، وسيتم تفعيل وظائفها في المهمة المخصصة لها."
      />
    </div>
  );
}
