import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BusinessCard } from "@/app/(app)/businesses/business-card";
import styles from "@/app/(app)/businesses/businesses.module.css";

export const dynamic = "force-dynamic";

const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

const cards = [
  {
    id: "123e4567-e89b-42d3-a456-426614174000",
    name: "أكاديمية ميزان",
    baseCurrency: "USD",
    currencyLabel: "دولار أمريكي",
    timezoneLabel: "القاهرة",
  },
  {
    id: "123e4567-e89b-42d3-a456-426614174001",
    name: "بزنس التدريب",
    baseCurrency: "SAR",
    currencyLabel: "ريال سعودي",
    timezoneLabel: "الرياض",
  },
];

/** CI-only fixture for N35 business-card hierarchy and responsive behavior. */
export default function BusinessCardsFixturePage() {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  return (
    <AppShell {...fixtureShellProps}>
      <section className="page-stack" aria-label="اختبار كروت البزنس">
        <section className={styles.grid} aria-label="البزنسات المتاحة">
          {cards.map((business) => (
            <BusinessCard key={business.id} business={business} />
          ))}
        </section>
      </section>
    </AppShell>
  );
}
