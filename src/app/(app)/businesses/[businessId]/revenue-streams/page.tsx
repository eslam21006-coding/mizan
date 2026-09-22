import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ReturnContextBanner } from "@/components/workflow-recovery";
import { requireAuthContext } from "@/lib/auth/context";
import {
  REVENUE_STREAM_TYPE_OPTIONS,
  parseResourceId,
} from "@/lib/business/revenue-streams";
import { parseSetupReturnOrigin } from "@/lib/setup-return-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteRevenueStream } from "./actions";
import { RevenueStreamsWorkspaceHeader } from "./revenue-streams-workspace-header";
import { RevenueStreamDrawerLauncher } from "./revenue-stream-drawer";
import styles from "./revenue-streams.module.css";

type RevenueStreamsPageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{
    status?: string;
    origin?: string | string[];
    month?: string | string[];
    upstream_origin?: string | string[];
    upstream_month?: string | string[];
    upstream_insight_rule?: string | string[];
    upstream_insight_subject?: string | string[];
    upstream_planner_step?: string | string[];
    upstream_planner_goal?: string | string[];
    upstream_planner_value?: string | string[];
  }>;
};

const STATUS_MESSAGES: Record<string, string> = {
  created: "تمت إضافة مصدر الإيراد.",
  updated: "تم حفظ تعديلات مصدر الإيراد.",
  deleted: "تم حذف مصدر الإيراد غير المستخدم.",
  "in-use": "لا يمكن حذف مصدر الإيراد لأنه مستخدم في بيانات سابقة. عطّله بدل الحذف للحفاظ على التاريخ.",
  invalid: "راجع الاسم والتصنيف وحاول مرة أخرى.",
  "create-failed": "تعذر إضافة مصدر الإيراد. لم يتم تغيير أي بيانات.",
  "update-failed": "تعذر حفظ التعديلات. لم يتم تغيير أي بيانات.",
  "delete-failed": "تعذر حذف مصدر الإيراد. لم يتم تغيير أي بيانات.",
};

function typeLabel(value: string) {
  return REVENUE_STREAM_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

/** Renders Revenue Sources with existing permissions, CRUD behavior, return context, and workspace navigation. */
export default async function RevenueStreamsPage({
  params,
  searchParams,
}: RevenueStreamsPageProps) {
  const { businessId: rawBusinessId } = await params;
  const businessId = parseResourceId(rawBusinessId);

  if (!businessId) {
    notFound();
  }

  const auth = await requireAuthContext();
  const supabase = await createSupabaseServerClient();
  const [{ data: business, error: businessError }, { data: streams, error: streamsError }] =
    await Promise.all([
      supabase
        .from("businesses")
        .select("id,name,base_currency,timezone,owner_user_id")
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

  const canManageRevenueStreams = auth.role === "admin" || business.owner_user_id === auth.userId;
  const query = await searchParams;
  const returnOrigin = parseSetupReturnOrigin({
    origin: query.origin,
    month: query.month,
    upstream_origin: query.upstream_origin,
    upstream_month: query.upstream_month,
    upstream_insight_rule: query.upstream_insight_rule,
    upstream_insight_subject: query.upstream_insight_subject,
    upstream_planner_step: query.upstream_planner_step,
    upstream_planner_goal: query.upstream_planner_goal,
    upstream_planner_value: query.upstream_planner_value,
  });
  const statusMessage = query.status ? STATUS_MESSAGES[query.status] : null;
  const isErrorStatus =
    query.status?.endsWith("failed") || query.status === "invalid" || query.status === "in-use";

  return (
    <div className="page-stack">
      <RevenueStreamsWorkspaceHeader
        businessId={businessId}
        businessName={business.name}
        baseCurrency={business.base_currency}
        timezone={business.timezone}
        canManage={canManageRevenueStreams}
        returnOrigin={returnOrigin}
        creationRequestId={randomUUID()}
      />

      {returnOrigin && (
        <ReturnContextBanner
          purpose="إضافة أو تعديل مصدر الإيراد المطلوب للشهر"
          origin={returnOrigin}
          context={{ businessId }}
          returnLabel="العودة إلى الإدخال الشهري"
          ariaLabel="سياق العودة من إعداد مصادر الإيراد"
        />
      )}

      {statusMessage && (
        <div className={isErrorStatus ? styles.errorStatus : styles.successStatus} role="status">
          {statusMessage}
        </div>
      )}

      {!canManageRevenueStreams && (
        <div className={styles.successStatus}>
          صلاحيتك في هذا البزنس للعرض فقط. يمكنك مراجعة مصادر الإيراد بدون إضافة أو تعديل أو حذف المصادر.
        </div>
      )}

      <section className={styles.explainer}>
        <div>
          <strong>Front-End / أمامي</strong>
          <p>مصدر الإيراد الذي يأتي في بداية رحلة العميل ويُستخدم في حساب تسييل تكلفة الإعلان.</p>
        </div>
        <div>
          <strong>Backend / خلفي</strong>
          <p>مصدر إيراد لاحق مثل ترقية، تجديد، عضوية، أو عرض إضافي بعد العلاقة الأولى مع العميل.</p>
        </div>
        <div>
          <strong>Other / أخرى</strong>
          <p>إيراد لا ينتمي بوضوح إلى Front-End أو Backend. لا يدخل في حساب Front-End Liquidation.</p>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div>
            <span className={styles.kicker}>المصادر الحالية</span>
            <h2>{canManageRevenueStreams ? "إدارة مصادر الإيراد" : "عرض مصادر الإيراد"}</h2>
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
                  <strong>{stream.name}</strong>
                  <div className={styles.streamToplineActions}>
                    <div className={styles.badgeRow}>
                      <span className={stream.is_active ? styles.activeBadge : styles.inactiveBadge}>
                        {stream.is_active ? "نشط" : "غير نشط"}
                      </span>
                      <span className={styles.typeBadge}>{typeLabel(stream.stream_type)}</span>
                    </div>
                    {canManageRevenueStreams && (
                      <RevenueStreamDrawerLauncher
                        businessId={businessId}
                        returnOrigin={returnOrigin}
                        typeOptions={REVENUE_STREAM_TYPE_OPTIONS}
                        mode="edit"
                        stream={{
                          id: stream.id,
                          name: stream.name,
                          stream_type: stream.stream_type,
                          is_active: stream.is_active,
                        }}
                      />
                    )}
                  </div>
                </div>

                {canManageRevenueStreams && (
                  <div className={styles.deleteRow}>
                    <p>الحذف متاح فقط إذا لم يُستخدم هذا المصدر في أي بيانات شهرية أو معاملات عملاء.</p>
                    <form action={deleteRevenueStream}>
                      <input type="hidden" name="business_id" value={businessId} />
                      <input type="hidden" name="stream_id" value={stream.id} />
                      {returnOrigin && (
                        <>
                          <input type="hidden" name="origin" value={returnOrigin.origin} />
                          <input type="hidden" name="month" value={returnOrigin.month} />
                          {returnOrigin.upstream && (
                            <input
                              type="hidden"
                              name="upstream_origin"
                              value={returnOrigin.upstream.origin}
                            />
                          )}
                          {(returnOrigin.upstream?.origin === "customer-profitability" ||
                            returnOrigin.upstream?.origin === "insights") &&
                            returnOrigin.upstream.month && (
                              <input
                                type="hidden"
                                name="upstream_month"
                                value={returnOrigin.upstream.month}
                              />
                            )}
                          {returnOrigin.upstream?.origin === "insights" && (
                            <>
                              <input
                                type="hidden"
                                name="upstream_insight_rule"
                                value={returnOrigin.upstream.ruleId}
                              />
                              {returnOrigin.upstream.subjectId && (
                                <input
                                  type="hidden"
                                  name="upstream_insight_subject"
                                  value={returnOrigin.upstream.subjectId}
                                />
                              )}
                            </>
                          )}
                          {returnOrigin.upstream?.origin === "target-planner" && (
                            <>
                              <input
                                type="hidden"
                                name="upstream_planner_step"
                                value={returnOrigin.upstream.step}
                              />
                              <input
                                type="hidden"
                                name="upstream_planner_goal"
                                value={returnOrigin.upstream.goal}
                              />
                              {returnOrigin.upstream.value !== undefined && (
                                <input
                                  type="hidden"
                                  name="upstream_planner_value"
                                  value={returnOrigin.upstream.value}
                                />
                              )}
                            </>
                          )}
                        </>
                      )}

                      <ConfirmSubmitButton
                        className={styles.deleteButton}
                        ariaLabel={`حذف مصدر الإيراد ${stream.name}`}
                        confirmMessage={`هل تريد حذف مصدر الإيراد «${stream.name}»؟ لا يمكن التراجع عن حذف مصدر غير مستخدم.`}
                      >
                        حذف المصدر
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                )}
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
        يمكن حذف المصدر إذا لم يُستخدم بعد. بمجرد ارتباطه ببيانات تاريخية يمنع ميزان الحذف، ويمكنك تعطيله بدلًا من ذلك حتى يظل التاريخ محفوظًا.
      </p>
    </div>
  );
}
