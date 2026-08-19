import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import {
  REVENUE_STREAM_TYPE_OPTIONS,
  parseResourceId,
} from "@/lib/business/revenue-streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createRevenueStream, updateRevenueStream } from "./actions";
import styles from "./revenue-streams.module.css";

type RevenueStreamsPageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ status?: string }>;
};

const STATUS_MESSAGES: Record<string, string> = {
  created: "تمت إضافة مصدر الإيراد.",
  updated: "تم حفظ تعديلات مصدر الإيراد.",
  invalid: "راجع الاسم والتصنيف وحاول مرة أخرى.",
  "create-failed": "تعذر إضافة مصدر الإيراد. لم يتم تغيير أي بيانات.",
  "update-failed": "تعذر حفظ التعديلات. لم يتم تغيير أي بيانات.",
};

function typeLabel(value: string) {
  return REVENUE_STREAM_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export default async function RevenueStreamsPage({
  params,
  searchParams,
}: RevenueStreamsPageProps) {
  const { businessId: rawBusinessId } = await params;
  const businessId = parseResourceId(rawBusinessId);

  if (!businessId) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: business, error: businessError }, { data: streams, error: streamsError }] =
    await Promise.all([
      supabase
        .from("businesses")
        .select("id,name,base_currency")
        .eq("id", businessId)
        .maybeSingle(),
      supabase
        .from("revenue_streams")
        .select("id,name,stream_type,is_active,created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: true }),
    ]);

  if (businessError || !business) {
    notFound();
  }

  const query = await searchParams;
  const statusMessage = query.status ? STATUS_MESSAGES[query.status] : null;
  const isErrorStatus = query.status?.endsWith("failed") || query.status === "invalid";

  return (
    <div className="page-stack">
      <div className={styles.headingRow}>
        <PageHeading
          title="مصادر الإيراد"
          description={`نظّم طرق دخول الإيراد في ${business.name} بدون إدخال أي أرقام مالية الآن.`}
        />
        <Link className={styles.backLink} href="/businesses">
          العودة للبزنسات
        </Link>
      </div>

      {statusMessage && (
        <div className={isErrorStatus ? styles.errorStatus : styles.successStatus} role="status">
          {statusMessage}
        </div>
      )}

      <section className={styles.explainer}>
        <div>
          <strong>Front-End / أمامي</strong>
          <p>مصدر الإيراد الذي يأتي في بداية رحلة العميل ويمكن استخدامه لاحقًا في قياس تصفية تكلفة الإعلان.</p>
        </div>
        <div>
          <strong>Backend / خلفي</strong>
          <p>مصدر إيراد لاحق مثل ترقية، تجديد، عضوية، أو عرض إضافي بعد العلاقة الأولى مع العميل.</p>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div>
            <span className={styles.kicker}>إضافة مصدر</span>
            <h2>مصدر إيراد جديد</h2>
          </div>
          <span className={styles.currency}>{business.base_currency}</span>
        </div>

        <form action={createRevenueStream} className={styles.createForm}>
          <input type="hidden" name="business_id" value={businessId} />
          <input type="hidden" name="creation_request_id" value={randomUUID()} />

          <label>
            <span>اسم مصدر الإيراد</span>
            <input
              type="text"
              name="name"
              maxLength={120}
              required
              placeholder="مثال: البرنامج الأساسي"
              autoComplete="off"
            />
          </label>

          <label>
            <span>التصنيف</span>
            <select name="stream_type" defaultValue="front_end">
              {REVENUE_STREAM_TYPE_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button type="submit">إضافة مصدر الإيراد</button>
        </form>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div>
            <span className={styles.kicker}>المصادر الحالية</span>
            <h2>إدارة مصادر الإيراد</h2>
          </div>
          <span className={styles.count}>{streams?.length ?? 0}</span>
        </div>

        {streamsError ? (
          <div className={styles.loadError}>
            تعذر تحميل مصادر الإيراد. لم يتم تغيير أي بيانات.
          </div>
        ) : streams && streams.length > 0 ? (
          <div className={styles.streamList}>
            {streams.map((stream) => (
              <article className={styles.streamCard} key={stream.id}>
                <div className={styles.streamTopline}>
                  <div>
                    <span className={stream.is_active ? styles.activeBadge : styles.inactiveBadge}>
                      {stream.is_active ? "نشط" : "غير نشط"}
                    </span>
                    <span className={styles.typeBadge}>{typeLabel(stream.stream_type)}</span>
                  </div>
                </div>

                <form action={updateRevenueStream} className={styles.editForm}>
                  <input type="hidden" name="business_id" value={businessId} />
                  <input type="hidden" name="stream_id" value={stream.id} />

                  <label>
                    <span>الاسم</span>
                    <input
                      type="text"
                      name="name"
                      maxLength={120}
                      required
                      defaultValue={stream.name}
                      autoComplete="off"
                    />
                  </label>

                  <label>
                    <span>التصنيف</span>
                    <select name="stream_type" defaultValue={stream.stream_type}>
                      {REVENUE_STREAM_TYPE_OPTIONS.map((option) => (
                        <option value={option.value} key={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.activeToggle}>
                    <input type="checkbox" name="is_active" defaultChecked={stream.is_active} />
                    <span>المصدر نشط ويظهر في الإدخالات الجديدة</span>
                  </label>

                  <button type="submit">حفظ التعديلات</button>
                </form>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <strong>لا توجد مصادر إيراد بعد</strong>
            <p>ابدأ بالمصدر الذي يدخل منه العميل أول مرة، ثم أضف الترقيات والتجديدات كمصادر Backend.</p>
          </div>
        )}
      </section>

      <p className={styles.historyNote}>
        إيقاف المصدر لا يحذفه. يحتفظ ميزان به حتى تظل البيانات التاريخية قابلة للربط به لاحقًا.
      </p>
    </div>
  );
}
