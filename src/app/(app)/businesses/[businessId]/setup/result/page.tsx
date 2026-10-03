import Link from "next/link";
import { notFound } from "next/navigation";
import { currentMonthKeyForTimeZone } from "@/lib/business/monthly";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { loadAuthenticatedSetupPayoff } from "@/lib/business/setup-payoff-server";
import type { PayoffBlockReason } from "@/lib/business/setup-payoff-result";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ month?: string | string[] }>;
};

const messages: Record<PayoffBlockReason, { title: string; detail: string }> = {
  missing_month: {
    title: "حدد شهر النتيجة",
    detail: "افتح الشهر المطلوب من خطوات الإعداد. لن نعرض أرقام شهر آخر بدلًا منه.",
  },
  invalid_month: {
    title: "الشهر المطلوب غير صحيح",
    detail: "رابط النتيجة يحتاج شهرًا واحدًا صحيحًا بصيغة سنة-شهر.",
  },
  future_month: {
    title: "لا يمكن عرض نتيجة شهر مستقبلي",
    detail: "اختر شهرًا حاليًا أو سابقًا محفوظًا ومكتملًا.",
  },
  not_saved: {
    title: "هذا الشهر غير محفوظ",
    detail: "راجع بيانات الشهر المحدد واحفظ أرقامه الفعلية قبل عرض النتيجة.",
  },
  month_incomplete: {
    title: "بيانات هذا الشهر غير مكتملة",
    detail: "راجع الأرقام الناقصة للشهر المحدد. لن نستبدلها ببيانات شهر آخر.",
  },
  setup_incomplete: {
    title: "أكمل إعداد البزنس أولًا",
    detail: "الشهر المحدد مكتمل، لكن واحدة أو أكثر من خطوات إعداد البزنس لم تكتمل بعد.",
  },
  data_load_error: {
    title: "تعذر التحقق من البيانات الآن",
    detail: "لم نعرض نتيجة قديمة أو مفترضة. أعد المحاولة عندما تصبح البيانات متاحة.",
  },
  calculation_error: {
    title: "تعذر حساب النتيجة",
    detail: "تم العثور على الشهر، لكن الحسابات المالية لم تكتمل بشكل موثوق. راجع بياناته.",
  },
};

function arabicMonth(monthKey: string) {
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric", month: "long", timeZone: "UTC",
  }).format(new Date(`${monthKey}-01T00:00:00.000Z`));
}

/**
 * B11.2: a read-only route that proves exact-month eligibility and loads canonical financials.
 * The four-metric presentation is intentionally reserved for B11.3.
 */
export default async function SetupPayoffPage({ params, searchParams }: Props) {
  const [{ businessId: rawBusinessId }, query] = await Promise.all([params, searchParams]);
  const businessId = parseResourceId(rawBusinessId);
  if (!businessId) notFound();

  const result = await loadAuthenticatedSetupPayoff(businessId, query.month);
  if (result.kind === "not_found") notFound();

  const business = result.business;
  const businessHref = business ? `/businesses/${encodeURIComponent(businessId)}` : "/businesses";
  const setupHref = business ? `${businessHref}/setup` : "/businesses";
  const stepMonthHref = result.monthKey
    ? `${setupHref}?step=month&month=${encodeURIComponent(result.monthKey)}`
    : `${setupHref}?step=month`;
  const monthlyHref = result.monthKey
    ? `${businessHref}/monthly?month=${encodeURIComponent(result.monthKey)}`
    : businessHref;
  const historical = result.monthKey && business
    ? result.monthKey < currentMonthKeyForTimeZone(business.timezone)
    : false;
  const reviewHref = result.kind === "month_incomplete" && historical
    ? `${businessHref}/monthly/correction?month=${encodeURIComponent(result.monthKey!)}`
    : stepMonthHref;

  if (result.kind !== "ready") {
    const message = messages[result.kind];
    const actionHref = result.kind === "data_load_error"
      ? "/businesses"
      : result.kind === "calculation_error"
        ? monthlyHref
        : result.kind === "setup_incomplete"
          ? setupHref
          : result.kind === "month_incomplete"
            ? reviewHref
            : stepMonthHref;
    return (
      <main className="page-stack">
        <section role="alert" aria-labelledby="result-state-title">
          <h1 id="result-state-title">{message.title}</h1>
          <p>{message.detail}</p>
          {business && result.monthKey && (
            <p>{business.name} · {arabicMonth(result.monthKey)}</p>
          )}
          <Link href={actionHref}>مراجعة الإعداد أو البيانات</Link>
        </section>
        <Link href={businessHref}>العودة للبزنسات أو لوحة البزنس</Link>
      </main>
    );
  }

  return (
    <main className="page-stack">
      <section aria-labelledby="result-ready-title">
        <h1 id="result-ready-title">نتيجة الشهر جاهزة</h1>
        <p>{result.business.name} · {arabicMonth(result.monthKey)} · {result.business.baseCurrency}</p>
        <p>تم التحقق من اكتمال البيانات وقراءة النتائج المالية لهذا الشهر من السجل المحفوظ.</p>
        <nav aria-label="الانتقال من نتيجة الإعداد">
          <Link href={businessHref}>فتح لوحة البزنس</Link>
          <Link href={monthlyHref}>مراجعة أرقام الشهر</Link>
        </nav>
      </section>
    </main>
  );
}
