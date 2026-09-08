import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { resolveBusinessRouteAccess } from "@/lib/business/route-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { setTransactionHistoryCompletenessAction } from "./actions";
import { TransactionPreviewUploader } from "./transaction-preview-uploader";
import styles from "./transaction-import.module.css";

type TransactionImportPageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Renders the transaction import workflow and the history-completeness control for one authorized business. */
export default async function TransactionImportPage({ params, searchParams }: TransactionImportPageProps) {
  const user = await requireUser();
  const { businessId } = await params;
  const query = await searchParams;
  const routeAccess = await resolveBusinessRouteAccess(businessId, user);
  if (!routeAccess) redirect("/businesses");

  const supabase = await createSupabaseServerClient();
  const [{ data: business }, { data: historyStatus, error: historyStatusError }] = await Promise.all([
    supabase
      .from("businesses")
      .select("id,name,base_currency,timezone,owner_user_id")
      .eq("id", businessId)
      .single(),
    supabase
      .from("customer_transaction_history_status")
      .select("business_id,history_complete,confirmed_at,confirmed_by_user_id")
      .eq("business_id", businessId)
      .maybeSingle(),
  ]);

  if (!business) redirect("/businesses");

  const { data: completionSummary, error: completionSummaryError } = await supabase.rpc(
    "transaction_import_completion_summary",
    {
      p_business_id: business.id,
      p_import_row_tokens: [],
    },
  );

  const savedPurchaseCount =
    completionSummary && typeof completionSummary === "object" && !Array.isArray(completionSummary)
      ? Number((completionSummary as Record<string, unknown>).saved_purchase_count ?? 0)
      : 0;
  const hasSavedCustomerPurchase =
    !completionSummaryError && Number.isSafeInteger(savedPurchaseCount) && savedPurchaseCount > 0;
  const transactionHistoryComplete = Boolean(historyStatus?.history_complete && hasSavedCustomerPurchase);
  const historyIntegrityMismatch = Boolean(historyStatus?.history_complete && !hasSavedCustomerPurchase);
  const canManage = routeAccess.canManage;
  const status = firstSearchParam(query.status);
  const statusMessage =
    status === "history-complete"
      ? "تم تأكيد اكتمال سجل المعاملات. سيستخدم ميزان أقدم تحصيل ناجح لكل بريد لتحديد العملاء الجدد والـCohorts."
      : status === "history-incomplete"
        ? "تم إلغاء تأكيد اكتمال السجل. سيعود العملاء الجدد للإدخال اليدوي حتى يكتمل التاريخ."
        : null;

  return (
    <main className={styles.page} dir="rtl">
      <div className={styles.headerRow}>
        <div>
          <Link className={styles.backLink} href={`/businesses/${business.id}/customers`}>
            العودة إلى العملاء
          </Link>
          <span className={styles.eyebrow}>Customer Transactions</span>
          <h1>استيراد معاملات العملاء</h1>
          <p>
            ارفع ملف CSV أو XLSX من بوابة الدفع. راجع البيانات أولًا، ثم استورد المعاملات الصالحة فقط بدون اختراع قيم ناقصة أو تحويل عملات تلقائيًا.
          </p>
        </div>
        <div className={styles.headerMeta}>
          <span>{business.name}</span>
          <strong>{business.base_currency}</strong>
        </div>
      </div>

      <section className={styles.historyPanel} aria-labelledby="transaction-history-title">
        <div className={styles.historyHeading}>
          <div>
            <span className={styles.kicker}>سجل المعاملات</span>
            <h2 id="transaction-history-title">هل رفعت كل تاريخ الدفع المتاح؟</h2>
          </div>
          <span className={transactionHistoryComplete ? styles.historyComplete : styles.historyIncomplete}>
            {transactionHistoryComplete ? "السجل مكتمل" : "السجل غير مؤكد"}
          </span>
        </div>

        {completionSummaryError ? (
          <p className={styles.splitNote}>
            تعذر التحقق من وجود معاملات محفوظة. لن يسمح ميزان بتأكيد اكتمال السجل حتى ينجح هذا التحقق.
          </p>
        ) : historyStatusError ? (
          <p className={styles.splitNote}>
            تعذر قراءة حالة اكتمال سجل المعاملات. أعد تحميل الصفحة قبل تغيير التأكيد.
          </p>
        ) : historyIntegrityMismatch ? (
          <p className={styles.splitNote}>
            لا توجد عملية شراء ناجحة محفوظة رغم أن السجل كان مؤكدًا كمكتمل. لن يعتمد ميزان هذا التأكيد؛ أكمل استيراد المعاملات أولًا.
          </p>
        ) : transactionHistoryComplete ? (
          <>
            <p className={styles.guideNote}>
              ميزان يعتبر أقدم تحصيل ناجح وموجب لكل بريد إلكتروني هو تاريخ اكتساب العميل، ويستخدمه لحساب العملاء الجدد وCohorts وObserved LTV.
            </p>
            {historyStatus?.confirmed_at && (
              <p className={styles.guideNote}>
                آخر تأكيد: <span dir="ltr">{new Date(historyStatus.confirmed_at).toLocaleString("en-GB")}</span>
              </p>
            )}
            {canManage && (
              <form action={setTransactionHistoryCompletenessAction} className={styles.guideCard}>
                <input type="hidden" name="business_id" value={business.id} />
                <input type="hidden" name="history_complete" value="false" />
                <strong>اكتشفت أن هناك تاريخ معاملات أقدم غير مرفوع؟</strong>
                <p className={styles.guideNote}>
                  ألغِ التأكيد فورًا. سيستمر ميزان في حساب إجمالي من دفعوا خلال كل شهر، لكن العملاء الجدد سيعودون للإدخال اليدوي حتى يكتمل التاريخ.
                </p>
                <button type="submit" className={styles.guideDownload}>
                  إلغاء تأكيد اكتمال السجل
                </button>
              </form>
            )}
          </>
        ) : !hasSavedCustomerPurchase ? (
          <div className={styles.guideCard}>
            <strong>لم تُحفظ أي عملية شراء ناجحة بعد.</strong>
            <p className={styles.guideNote}>
              رفع الملف أو مراجعته لا يحفظ المعاملات. أكمل خطوات الاستيراد واضغط «استيراد المعاملات» أولًا. بعد حفظ أول عملية شراء سيصبح تأكيد اكتمال التاريخ متاحًا.
            </p>
          </div>
        ) : (
          <>
            <p className={styles.guideNote}>
              تم حفظ {savedPurchaseCount.toLocaleString("en-US")} عملية شراء ناجحة. إجمالي العملاء الذين دفعوا خلال الشهر يمكن حسابه من معاملات ذلك الشهر وحدها، لكن تحديد العميل الجديد يحتاج معرفة هل له أي تحصيل ناجح أقدم من ذلك الشهر.
            </p>
            <p className={styles.splitNote}>
              لا تؤكد الاكتمال إذا كنت رفعت شهرًا واحدًا فقط أو جزءًا من التاريخ. في هذه الحالة سيظل «العملاء الجدد» إدخالًا يدويًا حتى لا يعتبر ميزان عميلًا قديمًا اشترى Upsell كعميل جديد.
            </p>
            {canManage && !historyStatusError && hasSavedCustomerPurchase && (
              <form action={setTransactionHistoryCompletenessAction} className={styles.guideCard}>
                <input type="hidden" name="business_id" value={business.id} />
                <input type="hidden" name="history_complete" value="true" />
                <label>
                  <input
                    type="checkbox"
                    name="history_confirmation"
                    value="confirmed"
                    required
                  />{" "}
                  أؤكد أنني رفعت كل تاريخ المعاملات المتاح للبزنس من أول عملية دفع، وليس شهرًا واحدًا فقط.
                </label>
                <button type="submit" className={styles.guideDownload}>
                  تأكيد اكتمال سجل المعاملات
                </button>
              </form>
            )}
          </>
        )}

        {statusMessage && <p className={styles.guideNote}>{statusMessage}</p>}
      </section>

      <section className={styles.importGuide} aria-labelledby="import-guide-title">
        <div className={styles.guideHeading}>
          <div>
            <span className={styles.kicker}>قبل رفع الملف</span>
            <h2 id="import-guide-title">ماذا يجب أن يحتوي الملف؟</h2>
          </div>
          <a
            className={styles.guideDownload}
            href="/mizan-transactions-template.csv"
            download="mizan-transactions-template.csv"
          >
            تنزيل النموذج الجاهز
          </a>
        </div>

        <div className={styles.guideGrid}>
          <article className={styles.guideCard}>
            <span className={styles.requiredBadge}>مطلوب</span>
            <ul>
              <li>
                <strong>البريد الإلكتروني للعميل</strong>
                <small dir="ltr">Customer Email</small>
              </li>
              <li>
                <strong>تاريخ المعاملة</strong>
                <small dir="ltr">Transaction Date</small>
                <small dir="ltr">مثال: 28-Aug-26 أو 2026-08-23</small>
              </li>
              <li>
                <strong>المبلغ المحصل</strong>
                <small dir="ltr">Amount Collected</small>
              </li>
            </ul>
          </article>

          <article className={styles.guideCard}>
            <span className={styles.optionalBadge}>اختياري</span>
            <ul>
              <li>
                <strong>اسم العميل</strong>
                <small dir="ltr">Customer Name / Name</small>
                <small>للعرض فقط؛ البريد الإلكتروني يظل هو هوية العميل داخل ميزان.</small>
              </li>
              <li>
                <strong>وقت المعاملة</strong>
                <small dir="ltr">Transaction Time</small>
                <small dir="ltr">مثال: 5:34 PM أو 17:34</small>
              </li>
              <li>
                <strong>المنطقة الزمنية</strong>
                <small dir="ltr">Timezone</small>
                <small dir="ltr">مثال: Africa/Cairo</small>
                <small>إذا كان الوقت موجودًا كعمود منفصل، اختر المنطقة الزمنية معه ليحوّلهما ميزان إلى توقيت واحد صحيح.</small>
              </li>
              <li>
                <strong>رقم المعاملة</strong>
                <small dir="ltr">Transaction ID</small>
                <small>يفضل وجوده لأنه يجعل اكتشاف التكرار أكثر دقة.</small>
              </li>
              <li>
                <strong>العملة</strong>
                <small dir="ltr">Currency</small>
                <small>إذا لم توجد في الملف، ستؤكد أن جميع المعاملات بعملة البزنس.</small>
              </li>
            </ul>
          </article>
        </div>

        <p className={styles.guideNote}>
          ميزان يحاول التعرف على أعمدة بوابة الدفع تلقائيًا، بما فيها Customer Name وDate وTime وTimezone عندما تكون موجودة أو منفصلة. إذا احتجت تعديل المطابقة يدويًا، يحفظها لنفس ترتيب الأعمدة في هذا البزنس.
        </p>
        <p className={styles.splitNote}>
          يجب أن يحتوي الملف الواحد على تحصيلات أو استرجاعات فقط. إذا كان التصدير يحتوي على النوعين، افصلهما إلى ملفين ثم ارفع كل ملف على حدة.
        </p>
      </section>

      <section className={styles.businessContext} aria-label="البزنس المحدد">
        <div>
          <span>البزنس</span>
          <strong>{business.name}</strong>
        </div>
        <div>
          <span>العملة الأساسية</span>
          <strong dir="ltr">{business.base_currency}</strong>
        </div>
        <div>
          <span>المنطقة الزمنية</span>
          <strong dir="ltr">{business.timezone}</strong>
        </div>
      </section>

      {canManage ? (
        <TransactionPreviewUploader
          businessId={business.id}
          baseCurrency={business.base_currency}
        />
      ) : (
        <section className={styles.splitNote}>
          يمكنك مراجعة سجل العملاء، لكن استيراد المعاملات وتغيير حالة اكتمال التاريخ متاحان لمالك البزنس أو الأدمن فقط.
        </section>
      )}
    </main>
  );
}
