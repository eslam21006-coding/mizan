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
          هذا إجراء دائم. بعد كتابة كلمة التأكيد سيحذف ميزان البزنس وكل البيانات المرتبطة به نهائيًا،
          بما فيها الأرقام الشهرية والفانلز والمعاملات وبيانات العملاء والمحاكي.
        </p>

        <div className={styles.warningList}>
          <div>
            <strong>التأكيد اليدوي مطلوب:</strong> اكتب «حذف» أو «Delete» قبل أن يصبح زر الحذف متاحًا.
          </div>
          <div>
            <strong>سيتم حذف كل بيانات البزنس:</strong> التأكيد يعني أنك تريد إزالة البزنس وتاريخه من ميزان بالكامل.
          </div>
          <div>
            <strong>لا يوجد تراجع:</strong> بعد نجاح الحذف لن يمكن استرجاع البزنس من داخل ميزان.
          </div>
        </div>

        {query.status === "confirmation-required" && (
          <div className={styles.statusError} role="alert">
            اكتب «حذف» أو «Delete» للتأكيد قبل تنفيذ العملية.
          </div>
        )}
        {query.status === "failed" && (
          <div className={styles.statusError} role="alert">
            تعذر حذف البزنس. لم يتم حذف جزء من البيانات؛ أعد تحميل الصفحة وحاول مرة أخرى.
          </div>
        )}

        <BusinessDeleteForm businessId={business.id} businessName={business.name} />
      </section>
    </div>
  );
}
