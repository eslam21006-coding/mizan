import Link from "next/link";
import type { CoreCalculationResult } from "@/lib/business/calculations";
import { buildSetupPayoffCards } from "@/lib/business/setup-payoff-display";
import styles from "./payoff.module.css";

type Props = {
  businessId: string;
  businessName: string;
  monthKey: string;
  currency: string;
  financials: CoreCalculationResult;
};

function arabicMonth(monthKey: string) {
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${monthKey}-01T00:00:00.000Z`));
}

/** Exact-month result presentation. Server-side authorization and eligibility stay in the route. */
export function PayoffScreen({ businessId, businessName, monthKey, currency, financials }: Props) {
  const cards = buildSetupPayoffCards(financials, currency);
  const businessHref = `/businesses/${encodeURIComponent(businessId)}`;
  const reviewHref = `${businessHref}/monthly?month=${encodeURIComponent(monthKey)}`;

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>نتيجة إعداد البزنس</p>
        <h1 className={styles.title} id="result-ready-title">جاهز — ميزان فهم البزنس</h1>
        <p className={styles.context}>
          <strong>{businessName}</strong>
          <span>{arabicMonth(monthKey)}</span>
          <span className={styles.currency} dir="ltr">{currency}</span>
        </p>
        <p className={styles.intro}>هذه نتيجة الشهر المحفوظ بعد مراجعة بيانات التحصيل والمصروفات الفعلية.</p>
      </header>

      <section className={styles.grid} aria-label="المؤشرات المالية الأربعة للشهر">
        {cards.map((card) => (
          <article className={styles.card} key={card.key} aria-labelledby={`metric-${card.key}`}>
            <h2 className={styles.label} id={`metric-${card.key}`}>{card.label}</h2>
            <strong
              className={[
                styles.value,
                card.negative ? styles.negative : "",
                card.unavailable ? styles.unavailable : "",
              ].filter(Boolean).join(" ")}
              dir="ltr"
            >
              {card.value}
            </strong>
            {card.explanation && <p className={styles.explanation}>{card.explanation}</p>}
            {card.description && <p className={styles.description}>{card.description}</p>}
          </article>
        ))}
      </section>

      <nav className={styles.actions} aria-label="الانتقال من نتيجة الإعداد">
        <Link className={styles.primary} href={businessHref}>افتح لوحة البزنس</Link>
        <Link className={styles.secondary} href={reviewHref}>مراجعة أرقام الشهر</Link>
      </nav>
    </div>
  );
}
