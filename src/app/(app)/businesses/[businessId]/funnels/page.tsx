import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireAuthContext } from "@/lib/auth/context";
import {
  FUNNEL_TYPE_OPTIONS,
  parseFunnelResourceId,
} from "@/lib/business/funnels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FunnelHierarchyBack } from "../funnel-hierarchy-back";
import { FunnelModuleShell } from "../funnel-module-shell";
import { FunnelCreateDrawerLauncher } from "./funnel-create-drawer";
import { FunnelList } from "./funnel-list";
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

/** Renders Funnel structure management with the persistent N40 module navigation. */
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
      <FunnelModuleShell businessId={businessId} activeTab="structure" />
      <FunnelHierarchyBack businessId={businessId} />

      <PageHeader
        title="الفانلز"
        description={`نظّم فانلز ${business.name} كطبقة اختيارية للتحليل. أرقام البزنس الأساسية تظل مستقلة عن وجود أي فانل.`}
        actionState={canManage ? "normal" : "read-only"}
        actionsAriaLabel="إجراءات الفانلز"
        actions={
          canManage ? (
            <FunnelCreateDrawerLauncher
              businessId={businessId}
              typeOptions={FUNNEL_TYPE_OPTIONS}
              creationRequestId={randomUUID()}
            />
          ) : undefined
        }
      />

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
          <strong>الأرقام الشهرية منفصلة عن الهيكل</strong>
          <p>هذه الصفحة لتعريف اسم الفانل ونوعها وحالتها. الأداء الشهري والـ KPIs يُسجَّلان في شاشة أرقام الفانلز الشهرية.</p>
        </div>
        <div>
          <strong>التاريخ محفوظ</strong>
          <p>عند توقف فانل، عطّلها بدل حذفها حتى تبقى البيانات التاريخية قابلة للربط بها لاحقًا.</p>
        </div>
      </section>

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
          <FunnelList businessId={businessId} funnels={funnels} canManage={canManage} />
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
