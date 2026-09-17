import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BusinessContext } from "@/components/business-context";
import { BackLink, Breadcrumb } from "@/components/navigation-hierarchy";
import { PageActionSlot, PageHeader } from "@/components/page-header";
import { InPageErrorState, ReturnContextBanner } from "@/components/workflow-recovery";
import {
  resolveNavigationDestination,
  type BreadcrumbItem,
} from "@/lib/navigation-hierarchy";
import { parseReturnOrigin, resolveReturnOrigin } from "@/lib/return-origin";

const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

const fixtureBusinessId = "business fixture/01";

const breadcrumbItems = [
  { label: "البزنسات", destination: { route: "businesses" } },
  {
    label: "أكاديمية ميزان",
    destination: { route: "business-overview", businessId: fixtureBusinessId },
  },
  { label: "اقتصاديات العملاء", current: true },
] satisfies readonly BreadcrumbItem[];

/** Renders the CI-only page used to verify navigation foundation primitives without migrating production modules. */
export default function NavigationFoundationE2eFixturePage() {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  const parsedOrigin = parseReturnOrigin({
    origin: "customer-profitability",
    month: "2026-08",
    returnTo: "https://unsafe.example/ignored",
  });
  if (!parsedOrigin) {
    throw new Error("Navigation foundation fixture must use a valid structured origin.");
  }
  const safeReturnHref = resolveNavigationDestination(
    resolveReturnOrigin(parsedOrigin, { businessId: fixtureBusinessId }),
  );
  const returnContext = { businessId: fixtureBusinessId };

  return (
    <AppShell {...fixtureShellProps}>
      <section className="page-stack" aria-label="اختبار أساس التنقل الداخلي">
        <BusinessContext businessName="أكاديمية ميزان" baseCurrency="SAR" timezone="Asia/Riyadh" />
        <Breadcrumb items={breadcrumbItems} />
        <BackLink
          label="العودة إلى البزنس"
          destination={{ route: "business-overview", businessId: fixtureBusinessId }}
        />
        <PageHeader
          eyebrow="اختبار معزول"
          title="اقتصاديات العملاء"
          description="يثبت هذا المسار خانة الإجراءات المستقرة ونموذج العودة المنظم وحالات الاسترداد داخل نفس هيكل الصفحة."
          actions={
            <Link className="primary-link" style={{ marginTop: 0 }} href={safeReturnHref}>
              عودة آمنة لربحية العميل
            </Link>
          }
        />

        <ReturnContextBanner
          purpose="بيانات أغسطس المطلوبة في ربحية العميل"
          origin={parsedOrigin}
          context={returnContext}
          returnLabel="العودة إلى ربحية العميل"
        />

        <section className="shell-grid" aria-label="حالات خانة الإجراءات">
          <article className="shell-card">
            <span className="eyebrow">تحميل</span>
            <PageActionSlot state="loading" ariaLabel="إجراءات الصفحة - تحميل" />
          </article>
          <article className="shell-card">
            <span className="eyebrow">عرض فقط</span>
            <PageActionSlot state="read-only" ariaLabel="إجراءات الصفحة - عرض فقط" />
          </article>
          <article className="shell-card">
            <span className="eyebrow">خطأ</span>
            <PageActionSlot state="error" ariaLabel="إجراءات الصفحة - خطأ" />
          </article>
          <article className="shell-card">
            <span className="eyebrow">إجراء شرطي غير متاح</span>
            <PageActionSlot ariaLabel="إجراءات الصفحة - شرط غير متاح">{false}</PageActionSlot>
          </article>
          <article className="shell-card">
            <span className="eyebrow">قائمة إجراءات فارغة</span>
            <PageActionSlot ariaLabel="إجراءات الصفحة - قائمة فارغة">{[]}</PageActionSlot>
          </article>
        </section>

        <InPageErrorState
          title="تعذر تحميل تفاصيل المراجعة"
          description="ظل سياق البزنس ومسار التنقل والعنوان كما هو، وتم استبدال منطقة المحتوى فقط بحالة خطأ قابلة للاسترداد."
          retryAction={<Link href="/auth/e2e-navigation-foundation">إعادة المحاولة</Link>}
          returnOrigin={parsedOrigin}
          returnContext={returnContext}
          returnLabel="العودة إلى ربحية العميل"
        />
      </section>
    </AppShell>
  );
}
