import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PageHeading } from "@/components/page-heading";
import { requireAuthContext } from "@/lib/auth/context";
import {
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_COST_BEHAVIOR_OPTIONS,
  isVariableExpenseBehavior,
  parseExpenseCostBehavior,
} from "@/lib/business/expenses";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createExpenseItem, deleteExpenseItem, updateExpenseItem } from "./actions";
import styles from "./expenses.module.css";

type ExpensesPageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ status?: string }>;
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
        .select("id,name,base_currency,owner_user_id")
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
  const statusMessage = query.status ? STATUS_MESSAGES[query.status] : null;
  const isErrorStatus =
    query.status?.endsWith("failed") || query.status === "invalid" || query.status === "in-use";

  return (
    <div className="page-stack">
      <div className={styles.headingRow}>
        <PageHeading
          title="هيكل المصروفات"
          description={`عرّف مصروفات ${business.name} وطريقة سلوك كل تكلفة بدون إدخال أي أرقام مالية الآن.`}
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

      {canManageExpenses && (
        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <span className={styles.kicker}>إضافة بند</span>
              <h2>مصروف جديد</h2>
            </div>
            <span className={styles.currency}>{business.base_currency}</span>
          </div>

          <form action={createExpenseItem} className={styles.createForm}>
            <input type="hidden" name="business_id" value={businessId} />
            <input type="hidden" name="creation_request_id" value={randomUUID()} />

            <label>
              <span>اسم المصروف</span>
              <input
                type="text"
                name="name"
                maxLength={120}
                required
                placeholder="مثال: إعلانات Meta"
                autoComplete="off"
              />
            </label>

            <label>
              <span>التصنيف</span>
              <select name="category" defaultValue="acquisition">
                {EXPENSE_CATEGORY_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>طريقة التكلفة</span>
              <select name="cost_behavior" defaultValue="fixed_monthly">
                {EXPENSE_COST_BEHAVIOR_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit">إضافة المصروف</button>
          </form>
          <p className={styles.formNote}>
            لن تدخل المبلغ أو النسبة هنا. الأرقام الفعلية لكل شهر ستدخل في خطوة البيانات الشهرية.
          </p>
        </section>
      )}

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
                  <div>
                    <span className={expense.is_active ? styles.activeBadge : styles.inactiveBadge}>
                      {expense.is_active ? "نشط" : "غير نشط"}
                    </span>
                    <span className={styles.categoryBadge}>{categoryLabel(expense.category)}</span>
                    <span className={styles.behaviorBadge}>
                      {behaviorLabel(expense.cost_behavior)}
                    </span>
                    <span className={styles.variableBadge}>{variableLabel(expense.cost_behavior)}</span>
                  </div>
                </div>

                {canManageExpenses && (
                  <>
                    <form action={updateExpenseItem} className={styles.editForm}>
                      <input type="hidden" name="business_id" value={businessId} />
                      <input type="hidden" name="expense_id" value={expense.id} />

                      <label>
                        <span>الاسم</span>
                        <input
                          type="text"
                          name="name"
                          maxLength={120}
                          required
                          defaultValue={expense.name}
                          autoComplete="off"
                        />
                      </label>

                      <label>
                        <span>التصنيف</span>
                        <select name="category" defaultValue={expense.category}>
                          {EXPENSE_CATEGORY_OPTIONS.map((option) => (
                            <option value={option.value} key={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span>طريقة التكلفة</span>
                        <select name="cost_behavior" defaultValue={expense.cost_behavior}>
                          {EXPENSE_COST_BEHAVIOR_OPTIONS.map((option) => (
                            <option value={option.value} key={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className={styles.activeToggle}>
                        <input type="checkbox" name="is_active" defaultChecked={expense.is_active} />
                        <span>المصروف نشط ويظهر في الإدخالات الجديدة</span>
                      </label>

                      <button type="submit">حفظ التعديلات</button>
                    </form>

                    <div className={styles.deleteRow}>
                      <p>الحذف متاح فقط إذا لم يُستخدم هذا البند في أي بيانات شهرية أو تخصيصات سابقة.</p>
                      <form action={deleteExpenseItem}>
                        <input type="hidden" name="business_id" value={businessId} />
                        <input type="hidden" name="expense_id" value={expense.id} />
                        <ConfirmSubmitButton
                          className={styles.deleteButton}
                          ariaLabel={`حذف المصروف ${expense.name}`}
                          confirmMessage={`هل تريد حذف المصروف «${expense.name}»؟ لا يمكن التراجع عن حذف بند غير مستخدم.`}
                        >
                          حذف المصروف
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <strong>لا توجد مصروفات معرفة بعد</strong>
            <p>ابدأ بأكبر بنود التكلفة لديك، ثم صنف كل بند وحدد هل هو ثابت أم يتحرك مع العملاء أو الإيراد.</p>
          </div>
        )}
      </section>

      <p className={styles.historyNote}>
        يمكن حذف المصروف إذا لم يُستخدم بعد. بمجرد ارتباطه ببيانات تاريخية يمنع ميزان الحذف، ويمكنك تعطيله بدلًا من ذلك حتى يظل التاريخ محفوظًا.
      </p>
    </div>
  );
}
