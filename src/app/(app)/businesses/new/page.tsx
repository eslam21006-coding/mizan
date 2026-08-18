import { randomUUID } from "node:crypto";
import { PageHeading } from "@/components/page-heading";
import { BusinessOnboardingWizard } from "./business-onboarding-wizard";

type BusinessOnboardingPageProps = {
  searchParams: Promise<{ status?: string }>;
};

const errorMessages: Record<string, string> = {
  invalid: "راجع اسم البزنس والعملة والمنطقة الزمنية ثم حاول مرة أخرى.",
  "create-failed": "تعذر إنشاء البزنس الآن. لم يتم حفظ أي إعدادات جديدة.",
};

export default async function BusinessOnboardingPage({
  searchParams,
}: BusinessOnboardingPageProps) {
  const params = await searchParams;
  const serverError = params.status ? errorMessages[params.status] : null;

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="إعداد البزنس"
        title="أضف بزنس جديد"
        description="نبدأ فقط بالمعلومات الأساسية التي تحدد هوية البزنس وكيفية قراءة الفترات المالية. الإيرادات والمصروفات والفانلز لها خطوات مستقلة لاحقًا."
      />
      <BusinessOnboardingWizard
        creationRequestId={randomUUID()}
        serverError={serverError}
      />
    </div>
  );
}
