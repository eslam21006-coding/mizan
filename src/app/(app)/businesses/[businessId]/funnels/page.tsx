import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { requireAuthContext } from "@/lib/auth/context";
import {
  FUNNEL_TYPE_OPTIONS,
  parseFunnelResourceId,
} from "@/lib/business/funnels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createFunnel, updateFunnel } from "./actions";
import styles from "./funnels.module.css";

type FunnelsPageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ status?: string }>;
};

const STATUS_MESSAGES: Record<string, string> = {
  created: "تمت إضافة الفانل.",
  updated: "تم حفظ تعديلات الفانل.",
  invalid: "راجع اسم الفانل ونوعها وحاول مرة أخرى.",
  "create-failed": "تعذر إضافة الفانل. لم يتم تغيير أي بيانات.",
  "update-failed": "تعذر حفظ تعديلات الفانل. لم يتم تغيير أي بيانات.",
};

function funnelTypeLabel(value: string) {
  return FUNNEL_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export default async function FunnelsPage({ params, searchParams }: FunnelsPageProps) {
  const { businessId: rawBusinessId } = await params;
  const businessId = parseFunnelResourceId(rawBusinessId);

  if (!businessId) {
    notFound();
  }

  const auth = await requireAuthContext();
  const supabase = await createSupabaseServerClient();
  const [{ data: business, error: businessError }, { data: funnels, error: funnelsError }] =
    await Promise.all([
      supabase
        .from("businesses")
        .select("id,name,owner_user_id")
        .eq("id", businessId)
        .maybeSingle(),
      supabase
        .from("funnels")
        .select("id,name,funnel_type,is_active,created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: true }),
    ]);

  if (businessError || !business) {
    notFound();
  }

  const canManage = auth.role === "admin" || business.owner_user_id === auth.userId;
  const query = await searchParams;
  const statusMessage = query.status ? STATUS_MESSAGES[query.status] : null;
  const isErrorStatus = query.status?.endsWith("failed") || query.status === "invalid";

  return (
    <div className="page-stack">
      <div className={styles.headingRow}>
        <PageHeading
          title="الفانلز"
          description={`نظّم فانلز ${business.name} كطبقة اختيارية للتحليل. أرقام البزنس الأساسية تظل مستقلة عن وجود أي فانل.`}
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

      {!canManage && (
        <section className={styles.readOnlyNotice}>
          <strong>عرض فقط</strong>
          <p>يمكنك مشاهدة فانلز هذا البزنس، لكن التعديل متاح للمالك أو الأدمن فقط.</p>
        </section>
      )}

      <section className={styles.explainer}>
        <div>
          <strong>اختيارية بالكامل</strong>
          <p>يمكن للبزنس العمل بدون فانلز، أو بفانل واحدة، أو بعدة فانلز. اقتصاديات البزنس تظل هي الأساس.</p>
        </div>
        <div>
          <strong>الهيكل فقط في هذه المهمة</strong>
          <p>هنا نعرّف اسم الفانل ونوعها وحالتها فقط. الإنفاق والليدز والمكالمات والمبيعات تبدأ في المهمة التالية.</p>
        </div>
        <div>
          <strong>التاريخ محفوظ</strong>
          <p>عند توقف فانل، عطّلها بدل حذفها حتى تبقى البيانات التاريخية قابلة للربط بها لاحقًا.</p>
        </div>
      </section>

      {canManage && (
        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <span className={styles.kicker}>إضافة فانل</span>
              <h2>فانل جديدة</h2>
            </div>
          </div>

          <form action={createFunnel} className={styles.createForm}>
            <input type="hidden" name="business_id" value={businessId} />
            <input type="hidden" name="creation_request_id" value={randomUUID()} />

            <label>
              <span>اسم الفانل</span>
              <input
                type="text"
                name="name"
                maxLength={120}
                required
                placeholder="مثال: ويبينار البرنامج الأساسي"
                autoComplete="off"
              />
            </label>

            <label>
              <span>نوع الفانل</span>
              <select name="funnel_type" defaultValue="webinar">
                {FUNNEL_TYPE_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit">إضافة الفانل</button>
          </form>
        </section>
      )}

      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div>
            <span className={styles.kicker}>الفانلز الحالية</span>
            <h2>إدارة الفانلز</h2>
          </div>
          <span className={styles.count}>{funnels?.length ?? 0}</span>
        </div>

        {funnelsError ? (
          <div className={styles.loadError}>تعذر تحميل الفانلز. لم يتم تغيير أي بيانات.</div>
        ) : funnels && funnels.length > 0 ? (
          <div className={styles.funnelList}>
            {funnels.map((funnel) => (
              <article className={styles.funnelCard} key={funnel.id}>
                <div className={styles.funnelTopline}>
                  <div>
                    <span className={funnel.is_active ? styles.activeBadge : styles.inactiveBadge}>
                      {funnel.is_active ? "نشطة" : "غير نشطة"}
                    </span>
                    <span className={styles.typeBadge}>{funnelTypeLabel(funnel.funnel_type)}</span>
                  </div>
                </div>

                {canManage ? (
                  <form action={updateFunnel} className={styles.editForm}>
                    <input type="hidden" name="business_id" value={businessId} />
                    <input type="hidden" name="funnel_id" value={funnel.id} />

                    <label>
                      <span>الاسم</span>
                      <input
                        type="text"
                        name="name"
                        maxLength={120}
                        required
                        defaultValue={funnel.name}
                        autoComplete="off"
                      />
                    </label>

                    <label>
                      <span>النوع</span>
                      <select name="funnel_type" defaultValue={funnel.funnel_type}>
                        {FUNNEL_TYPE_OPTIONS.map((option) => (
                          <option value={option.value} key={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={styles.activeToggle}>
                      <input type="checkbox" name="is_active" defaultChecked={funnel.is_active} />
                      <span>الفانل نشطة وتظهر في الإدخالات الجديدة</span>
                    </label>

                    <button type="submit">حفظ التعديلات</button>
                  </form>
                ) : (
                  <div className={styles.readOnlyFunnel}>
                    <strong>{funnel.name}</strong>
                    <span>{funnelTypeLabel(funnel.funnel_type)}</span>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <strong>لا توجد فانلز بعد</strong>
            <p>هذا طبيعي. الفانلز اختيارية، ولا يحتاج البزنس إلى فانل حتى يعمل حساب ميزان الأساسي.</p>
          </div>
        )}
      </section>

      <p className={styles.historyNote}>
        هذه الصفحة لا تجمع أي أرقام مالية ولا تغيّر صافي الربح أو CAC أو أي KPI على مستوى البزنس.
      </p>
    </div>
  );
}
