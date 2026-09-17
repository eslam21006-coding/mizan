import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import {
  MonthlyEntryForm,
  type ExpenseInputRow,
  type RevenueInputRow,
} from "@/app/(app)/businesses/[businessId]/monthly/monthly-entry-form";
import saveBarStyles from "@/app/(app)/businesses/[businessId]/monthly/monthly-save-bar.module.css";
import styles from "@/app/(app)/businesses/[businessId]/monthly/monthly.module.css";
import { AppShell } from "@/components/app-shell";
import { ReturnContextBanner } from "@/components/workflow-recovery";
import { parseReturnOrigin } from "@/lib/return-origin";

const BUSINESS_ID = "00000000-0000-4000-8000-000000000025";
const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

type MonthlyEntryE2eFixturePageProps = {
  searchParams: Promise<{ origin?: string | string[] }>;
};

const revenueRows: RevenueInputRow[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Front-End Offer",
    streamType: "front_end",
    active: true,
    gross: "30000",
    refunds: "2000",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "High Ticket Program",
    streamType: "backend",
    active: true,
    gross: "20000",
    refunds: "1000",
  },
];

const expenseRows: ExpenseInputRow[] = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Meta Ads",
    category: "acquisition",
    behavior: "fixed_monthly",
    active: true,
    value: "10000",
    basis: "",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    name: "Coach Fulfillment",
    category: "fulfillment",
    behavior: "per_customer",
    active: true,
    value: "200",
    basis: "total_paying_customers",
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    name: "Software",
    category: "overhead",
    behavior: "fixed_monthly",
    active: true,
    value: "3000",
    basis: "",
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    name: "Payment Fees",
    category: "financial",
    behavior: "percentage_revenue",
    active: true,
    value: "3",
    basis: "",
  },
];

/** Renders the isolated Monthly editor with an optional safe profitability return context. */
export default async function MonthlyEntryE2eFixturePage({
  searchParams,
}: MonthlyEntryE2eFixturePageProps) {
  await connection();
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  const query = await searchParams;
  const parsedOrigin = parseReturnOrigin({ origin: query.origin });
  const returnOrigin = parsedOrigin?.origin === "customer-profitability" ? parsedOrigin : null;

  return (
    <AppShell {...fixtureShellProps}>
      <div className="page-stack">
        <div>
          <span className="eyebrow">اختبار الإدخال الشهري</span>
          <h1>الإدخال الشهري</h1>
          <p className="muted-copy">واجهة اختبار معزولة للتحقق من وضوح الإدخال واتجاه RTL والاستجابة.</p>
        </div>

        {returnOrigin && (
          <ReturnContextBanner
            purpose="بيانات مطلوبة في ربحية العميل"
            origin={returnOrigin}
            context={{ businessId: BUSINESS_ID }}
            returnLabel="العودة إلى ربحية العميل"
            ariaLabel="العودة إلى ربحية العميل"
          />
        )}

        <section className={styles.monthBar} aria-label="اختيار الشهر">
          <Link className={styles.monthNavButton} href="#previous">
            <span aria-hidden="true">→</span>
            <span>الشهر السابق</span>
          </Link>
          <div className={styles.monthCenter}>
            <span className={styles.monthEyebrow}>الشهر الحالي في النموذج</span>
            <strong>أغسطس ٢٠٢٦</strong>
            <span className={styles.savedState}>محفوظ</span>
          </div>
          <Link className={styles.monthNavButton} href="#next">
            <span>الشهر التالي</span>
            <span aria-hidden="true">←</span>
          </Link>
        </section>

        <form className={styles.monthForm}>
          <MonthlyEntryForm
            editable
            currency="USD"
            revenueRows={revenueRows}
            expenseRows={expenseRows}
            period={{
              new_customers: 20,
              total_paying_customers: 25,
              unallocated_gross_cash_collected: null,
              unallocated_refunds: null,
              adjustment_note: null,
            }}
          />
          <div
            className={`${styles.saveBar} ${saveBarStyles.mobileSafeSaveBar}`}
            data-testid="monthly-save-bar"
          >
            <div>
              <strong>حفظ أرقام أغسطس ٢٠٢٦</strong>
              <p>واجهة اختبار فقط — لا يتم حفظ أي بيانات.</p>
            </div>
            <button type="button">حفظ الشهر</button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
