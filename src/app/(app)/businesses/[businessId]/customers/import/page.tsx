import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { requireAuthContext } from "@/lib/auth/context";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { setTransactionHistoryCompletenessAction } from "./actions";
import styles from "./transaction-import.module.css";
import { TransactionPreviewUploader } from "./transaction-preview-uploader";

type TransactionImportPageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ historyStatus?: string }>;
};

const IMPORT_THEME_ALIASES = {
  "--text-primary": "var(--text)",
  "--text-secondary": "var(--text-soft)",
  "--surface-primary": "var(--surface)",
  "--surface-secondary": "var(--surface-soft)",
  "--border-subtle": "var(--border)",
  "--accent-primary": "var(--brand)",
} as CSSProperties;

/** Returns the user-facing status copy for a history-completeness transition. */
function historyStatusMessage(status: string | undefined) {
  if (status === "complete") return "تم تأكيد اكتمال سجل المعاملات. يمكن لميزان الآن تحديد العملاء الجدد تلقائيًا.";
  if (status === "incomplete") return "تم إلغاء تأكيد اكتمال السجل. العملاء الجدد سيبقون إدخالًا يدويًا حتى تعيد التأكيد.";
  if (status === "confirmation-required") return "يجب تأكيد أنك رفعت كل تاريخ المعاملات قبل تفعيل الحساب التلقائي للعملاء الجدد.";
  if (status === "update-failed") return "تعذر تحديث حالة سجل المعاملات. لم يتم تغيير الحالة الحالية.";
  return null;
}

export default async function TransactionImportPage({
  params,
  searchParams,
}: TransactionImportPageProps) {
  const [{ businessId: rawBusinessId }, query] = await Promise.all([params, searchParams]);
  const businessId = parseResourceId(rawBusinessId);
  if (!businessId) notFound();

  const auth = await requireAuthContext();
  const supabase = await createSupabaseServerClient();
  const { data: business, error } = await supabase
    .from("businesses")
    .select("id,name,base_currency,timezone,owner_user_id")
    .eq("id", businessId)
    .maybeSingle();

  if (error || !business) notFound();

  const { data: historyStatus, error: historyStatusError } = await supabase
    .from("business_transaction_history_status")
    .select("is_complete,confirmed_at")
    .eq("business_id", businessId)
    .maybeSingle();

  const canManage = auth.role === "admin" || business.owner_user_id === auth.userId;
  const transactionHistoryComplete = historyStatus?.is_complete === true;
  const statusMessage = historyStatusMessage(query.historyStatus);

  return (
    <div className="page-stack" style={IMPORT_THEME_ALIASES}>
      <div className={styles.headingRow}>
        <PageHeading
          title="استيراد معاملات العملاء"
          description="ارفع ملف CSV أو XLSX من بوابة الدفع، ثم راجع البيانات قبل حفظها في ميزان."
        />
        <div className={styles.headingLinks}>
          <a
            className={`${styles.backLink} ${styles.templateLink}`}
            href="/mizan-transactions-template.csv"
            download="mizan-transactions-template.csv"
          >
            تنزيل نموذج CSV
          </a>
          <Link className={styles.backLink} href="/customers">
            العملاء و LTV
          </Link>
          <Link className={styles.backLink} href={`/?business=${business.id}`}>
            الداشبورد
          </Link>
        </div>
      </div>

      <section className={styles.importGuide} aria-labelledby="history-completeness-title">
        <div className={styles.guideHeading}>
          <div>
            <span className={transactionHistoryComplete ? styles.requiredBadge : styles.optionalBadge}>
              {transactionHistoryComplete ? "السجل مكتمل" : "السجل غير مؤكد كمكتمل"}
            </span>
            <h2 id="history-completeness-title">هل رفعت تاريخ المعاملات من بداية البزنس؟</h2>
          </div>
        </div>

        {historyStatusError ? (
          <p className={styles.splitNote}>
            تعذر قراءة حالة اكتمال سجل المعاملات. لن يعتمد ميزان على تاريخ أول عملية لتحديد العملاء الجدد حتى تُحل المشكلة.
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
        ) : (
          <>
            <p className={styles.guideNote}>
              إجمالي العملاء الذين دفعوا خلال الشهر يمكن حسابه من معاملات ذلك الشهر وحدها. لكن تحديد العميل الجديد يحتاج معرفة هل له أي تحصيل ناجح أقدم من ذلك الشهر.
            </p>
            <p className={styles.splitNote}>
              لا تؤكد الاكتمال إذا كنت رفعت شهرًا واحدًا فقط أو جزءًا من التاريخ. في هذه الحالة سيظل «العملاء الجدد» إدخالًا يدويًا حتى لا يعتبر ميزان عميلًا قديمًا اشترى Upsell كعميل جديد.
            </p>
            {canManage && !historyStatusError && (
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
                <small dir="ltr">مثال: 2026-08-23 أو 2026-08-23T14:30:00+03:00</small>
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
          ميزان يحاول التعرف على أعمدة بوابة الدفع تلقائيًا. إذا احتجت تعديل المطابقة يدويًا، يحفظها لنفس ترتيب الأعمدة في هذا البزنس.
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
        <p className={styles.businessContextNote}>
          لن تُحفظ أي معاملة قبل مراجعة الملف وتأكيد الاستيراد.
        </p>
      </section>

      <TransactionPreviewUploader
        businessId={business.id}
        baseCurrency={business.base_currency}
        canManage={canManage}
      />
    </div>
  );
}
