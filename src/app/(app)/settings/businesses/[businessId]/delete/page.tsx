import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAuthContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BusinessDeleteForm } from "./business-delete-form";
import styles from "./business-delete.module.css";

type DeleteBusinessPageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ status?: string }>;
};

export default async function DeleteBusinessPage({ params, searchParams }: DeleteBusinessPageProps) {
  const [{ businessId }, query, auth] = await Promise.all([
    params,
    searchParams,
    requireAuthContext(),
  ]);
  const supabase = await createSupabaseServerClient();
  const { data: business, error } = await supabase
    .from("businesses")
    .select("id,name,owner_user_id")
    .eq("id", businessId)
    .maybeSingle();

  if (error || !business) {
    notFound();
  }

  const canDelete = auth.role === "admin" || business.owner_user_id === auth.userId;
  if (!canDelete) {
    redirect("/access-denied");
  }

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} href="/settings">
        ← العودة إلى الإعدادات
      </Link>

      <section className={styles.dangerCard} aria-labelledby="delete-business-title">
        <span className={styles.dangerBadge}>منطقة خطرة</span>
        <h1 id="delete-business-title">حذف {business.name}</h1>
        <p className={styles.warningCopy} id="business-delete-warning">
          هذا إجراء دائم. ميزان لن ينفذ الحذف إلا بعد كتابة كلمة التأكيد، كما أن قاعدة البيانات
          ستمنع العملية تلقائيًا إذا كان هناك تاريخ أو بيانات مرتبطة محمية من الحذف.
        </p>

        <div className={styles.warningList}>
          <div>
            <strong>التأكيد اليدوي مطلوب:</strong> اكتب «حذف» أو «Delete» قبل أن يصبح زر الحذف متاحًا.
          </div>
          <div>
            <strong>حماية التاريخ:</strong> وجود بيانات محمية قد يمنع حذف البزنس حتى بعد التأكيد.
          </div>
          <div>
            <strong>لا يوجد تراجع:</strong> إذا تم الحذف بنجاح فلن يمكن استرجاع البزنس من داخل ميزان.
          </div>
        </div>

        {query.status === "confirmation-required" && (
          <div className={styles.statusError} role="alert">
            اكتب «حذف» أو «Delete» للتأكيد قبل تنفيذ العملية.
          </div>
        )}
        {query.status === "protected-data" && (
          <div className={styles.statusProtected} role="alert">
            لم يتم حذف البزنس لأن هناك بيانات مرتبطة محمية. لم يتم تغيير أو حذف أي من هذه البيانات.
          </div>
        )}
        {query.status === "failed" && (
          <div className={styles.statusError} role="alert">
            تعذر حذف البزنس. لم يتم تغيير أي بيانات. أعد تحميل الصفحة وحاول مرة أخرى.
          </div>
        )}

        <BusinessDeleteForm businessId={business.id} businessName={business.name} />
      </section>
    </div>
  );
}
