import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ReturnContextBanner } from "@/components/workflow-recovery";
import { requireAuthContext } from "@/lib/auth/context";
import {
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_COST_BEHAVIOR_OPTIONS,
  isVariableExpenseBehavior,
  parseExpenseCostBehavior,
} from "@/lib/business/expenses";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { parseSetupReturnOrigin } from "@/lib/setup-return-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteExpenseItem } from "./actions";
import { ExpenseDrawerLauncher } from "./expense-drawer";
import { ExpensesWorkspaceHeader } from "./expenses-workspace-header";
import styles from "./expenses.module.css";

type ExpensesPageProps = {
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
  created: "تمت إضافة بند المصروف.",
  updated: "تم حفظ تعديلات بند المصروف.",
  deleted: "تم حذف بند المصروف غير المستخدم.",
  "in-use": "لا يمكن حذف هذا المصروف لأنه مستخدم في بيانات سابقة. عطّله بدل الحذف للحفاظ على التاريخ.",
  invalid: "راجع الاسم والتصنيف وطريقة التكلفة وحاول مرة أخرى.",
  "create-failed": "تعذر إضافة بند المصروف. لم يتم تغيير أي بيانات.",
  "update-failed": "تعذر حفظ التعديلات. لم يتم تغيير أي بيانات.",
  "delete-failed": "تعذر حذف بند المصروف. لم يتم تغيير أي بيانات.",
};

function categoryLabel(value: string) {
  return EXPENSE_CATEGORY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function behaviorLabel(value: string) {
  return EXPENSE_COST_BEHAVIOR_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function variableLabel(value: string) {
  const behavior = parseExpenseCostBehavior(value);
  return behavior && isVariableExpenseBehavior(behavior) ? "تكلفة متغيرة" : "تكلفة ثابتة";
}

/** Renders Expense Structure with existing permissions, CRUD behavior, return context, and workspace navigation. */
export default async function ExpensesPage({ params, searchParams }: ExpensesPageProps) {
  const { businessId: rawBusinessId } = await params;
  const businessId = parseResourceId(rawBusinessId);

  if (!businessId) {
    notFound();
  }

  const auth = await requireAuthContext();
  const supabase = await createSupabaseServerClient();
  const [{ data: business, error: businessError }, { data: expenses, error: expensesError }] =
    await Promise.all([
      supabase
        .from("businesses")
        .select("id,name,base_currency,timezone,owner_user_id")
        .eq("id", businessId)
        .maybeSingle(),
      supabase
        .from("expense_items")
        .select("id,name,category,cost_behavior,is_active,created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: true }),
    ]);

  if (businessError || !business) {
    notFound();
  }

  const canManageExpenses = auth.role === "admin" || business.owner_user_id === auth.userId;
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
      <ExpensesWorkspaceHeader
        businessId={businessId}
        businessName={business.name}
        baseCurrency={business.base_currency}
        timezone={business.timezone}
        canManage={canManageExpenses}
        returnOrigin={returnOrigin}
        creationRequestId={randomUUID()}
      />

      {returnOrigin && (
        <ReturnContextBanner
          purpose="إضافة أو تعديل بند المصروف المطلوب للشهر"
          origin={returnOrigin}
          context={{ businessId }}
          returnLabel="العودة إلى الإدخال الشهري"
          ariaLabel="سياق العودة من إعداد المصروفات"
        />
      )}

      {statusMessage && (
        <div className={isErrorStatus ? styles.errorStatus : styles.successStatus} role="status">
          {statusMessage}
        </div>
      )}

      {!canManageExpenses && (
        <div className={styles.successStatus}>
          صلاحيتك في هذا البزنس للعرض فقط. يمكنك مراجعة هيكل المصروفات بدون إضافة أو تعديل أو حذف البنود.
        </div>
      )}

      <section className={styles.behaviorGrid} aria-label="طرق سلوك التكلفة">
        {EXPENSE_COST_BEHAVIOR_OPTIONS.map((option) => (
          <div key={option.value}>
            <strong>{option.label}</strong>
            <p>{option.description}</p>
            <span>{isVariableExpenseBehavior(option.value) ? "متغيرة" : "ثابتة"}</span>
          </div>
        ))}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div>
            <span className={styles.kicker}>تصنيفات المصروفات</span>
            <h2>أين تضع كل مصروف؟</h2>
          </div>
        </div>
        <div className={styles.categoryGrid}>
          {EXPENSE_CATEGORY_OPTIONS.map((option) => (
            <div key={option.value}>
              <strong>{option.label}</strong>
              <p>{option.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div>
            <span className={styles.kicker}>المصروفات الحالية</span>
            <h2>{canManageExpenses ? "إدارة هيكل المصروفات" : "عرض هيكل المصروفات"}</h2>
          </div>
          <span className={styles.count}>{expenses?.length ?? 0}</span>
        </div>

        {expensesError ? (
          <div className={styles.loadError}>تعذر تحميل المصروفات. لم يتم تغيير أي بيانات.</div>
        ) : expenses && expenses.length > 0 ? (
          <div className={styles.expenseList}>
            {expenses.map((expense) => (
              <article className={styles.expenseCard} key={expense.id}>
                <div className={styles.expenseTopline}>
                  <strong>{expense.name}</strong>
                  <div className={styles.expenseToplineActions}>
                    <div className={styles.badgeRow}>
                      <span className={expense.is_active ? styles.activeBadge : styles.inactiveBadge}>
                        {expense.is_active ? "نشط" : "غير نشط"}
                      </span>
                      <span className={styles.categoryBadge}>{categoryLabel(expense.category)}</span>
                      <span className={styles.behaviorBadge}>
                        {behaviorLabel(expense.cost_behavior)}
                      </span>
                      <span className={styles.variableBadge}>{variableLabel(expense.cost_behavior)}</span>
                    </div>
                    {canManageExpenses && (
                      <ExpenseDrawerLauncher
                        businessId={businessId}
                        returnOrigin={returnOrigin}
                        categoryOptions={EXPENSE_CATEGORY_OPTIONS}
                        behaviorOptions={EXPENSE_COST_BEHAVIOR_OPTIONS}
                        mode="edit"
                        expense={{
                          id: expense.id,
                          name: expense.name,
                          category: expense.category,
                          cost_behavior: expense.cost_behavior,
                          is_active: expense.is_active,
                        }}
                      />
                    )}
                  </div>
                </div>

                {canManageExpenses && (
                  <div className={styles.deleteRow}>
                    <p>الحذف متاح فقط إذا لم يُستخدم هذا البند في أي بيانات شهرية أو تخصيصات سابقة.</p>
                    <form action={deleteExpenseItem}>
                      <input type="hidden" name="business_id" value={businessId} />
                      <input type="hidden" name="expense_id" value={expense.id} />
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
                        ariaLabel={`حذف المصروف ${expense.name}`}
                        confirmMessage={`هل تريد حذف المصروف «${expense.name}»؟ لا يمكن التراجع عن حذف بند غير مستخدم.`}
                      >
                        حذف المصروف
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <strong>لا توجد مصروفات معرفة بعد</strong>
            <p>
              هذا متوقع في البزنس الجديد، لكن الإدخال الشهري لن يعرض بنود التكلفة حتى تبني الهيكل.
              ابدأ بأكبر بنود التكلفة لديك، ثم صنف كل بند وحدد هل هو ثابت أم يتحرك مع العملاء أو الإيراد.
            </p>
            <div className={styles.emptyActions}>
              {canManageExpenses ? (
                <ExpenseDrawerLauncher
                  businessId={businessId}
                  returnOrigin={returnOrigin}
                  categoryOptions={EXPENSE_CATEGORY_OPTIONS}
                  behaviorOptions={EXPENSE_COST_BEHAVIOR_OPTIONS}
                  mode="create"
                  creationRequestId={randomUUID()}
                />
              ) : (
                <Link className={styles.emptyLink} href={`/businesses/${businessId}`}>
                  العودة إلى نظرة عامة
                </Link>
              )}
            </div>
          </div>
        )}
      </section>

      <p className={styles.historyNote}>
        يمكن حذف المصروف إذا لم يُستخدم بعد. بمجرد ارتباطه ببيانات تاريخية يمنع ميزان الحذف، ويمكنك تعطيله بدلًا من ذلك حتى يظل التاريخ محفوظًا.
      </p>
    </div>
  );
}
