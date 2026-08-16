import { EmptyModule } from "@/components/empty-module";
import { PageHeading } from "@/components/page-heading";

export default function Page() {
  return (
    <div className="page-stack">
      <PageHeading
        title="العملاء و LTV"
        description="حلّل معاملات العملاء والقيمة المحققة عبر الزمن دون خلطها بمقاييس الفترة."
      />
      <EmptyModule
        title="بيانات العملاء"
        description="هذه المساحة جاهزة داخل هيكل التطبيق، وسيتم تفعيل وظائفها في المهمة المخصصة لها."
      />
    </div>
  );
}
