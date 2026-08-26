"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./customer-groups.module.css";

type LifetimeRevenueStreamRow = {
  business_id: string;
  revenue_stream_id: string | null;
  revenue_stream_name: string | null;
  revenue_stream_type: "front_end" | "backend" | null;
  is_unattributed: boolean;
  cohort_count: number | string;
  transaction_count: number | string;
  customers_with_activity: number | string;
  gross_cash_collected_text: string;
  refunds_text: string;
  net_cash_collected_text: string;
  currency: string | null;
};

type Props = {
  businessId: string;
  baseCurrency: string;
};

function streamTypeLabel(value: LifetimeRevenueStreamRow["revenue_stream_type"]) {
  if (value === "front_end") return "Front-End";
  if (value === "backend") return "Backend";
  return "غير منسوب";
}

function money(value: string, currency: string) {
  return `${value} ${currency}`;
}

export function LifetimeRevenueStreamTable({ businessId, baseCurrency }: Props) {
  const [rows, setRows] = useState<LifetimeRevenueStreamRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { data, error: loadError } = await supabase
      .from("customer_lifetime_revenue_stream_analysis")
      .select(
        "business_id,revenue_stream_id,revenue_stream_name,revenue_stream_type,is_unattributed,cohort_count,transaction_count,customers_with_activity,gross_cash_collected_text,refunds_text,net_cash_collected_text,currency",
      )
      .eq("business_id", businessId)
      .order("is_unattributed", { ascending: true })
      .order("net_cash_collected", { ascending: false });

    if (loadError) {
      setRows([]);
      setError("تعذر تحميل تحليل مصادر الإيراد مدى الحياة. حاول مرة أخرى.");
    } else {
      setRows((data ?? []) as LifetimeRevenueStreamRow[]);
    }
    setIsLoading(false);
  }, [businessId]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  if (isLoading) {
    return <section className={styles.statusPanel}>جاري تحليل مصادر الإيراد عبر عمر العميل…</section>;
  }

  if (error) {
    return (
      <section className={styles.errorPanel} role="alert">
        <strong>تعذر تحميل تحليل مصادر الإيراد</strong>
        <p>{error}</p>
        <button className={styles.retryButton} type="button" onClick={() => void loadRows()}>
          إعادة المحاولة
        </button>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section className={styles.compactEmptyPanel}>
        <strong>لا توجد بيانات كافية لتحليل مصادر الإيراد بعد.</strong>
        <span>بعد استيراد معاملات العملاء، اربط المعاملات بمصادر الإيراد ليظهر توزيع القيمة المحققة.</span>
        <Link href={`/businesses/${businessId}/customers/revenue-stream-attribution`}>
          ربط المعاملات بمصادر الإيراد
        </Link>
      </section>
    );
  }

  const unattributed = rows.find((row) => row.is_unattributed);

  return (
    <section className={styles.groupPanel} aria-labelledby="lifetime-stream-title">
      <div className={styles.groupHeading}>
        <div>
          <span className={styles.kicker}>القيمة المحققة حسب مصدر الإيراد</span>
          <h2 id="lifetime-stream-title">تحليل مصادر الإيراد مدى الحياة</h2>
          <p>
            يعتمد فقط على ربط صريح للمعاملات. ميزان لا يخمّن مصدر الإيراد من بوابة الدفع أو قيمة المعاملة.
          </p>
        </div>
        <Link className={styles.retryButton} href={`/businesses/${businessId}/customers/revenue-stream-attribution`}>
          ربط المعاملات
        </Link>
      </div>

      {unattributed && (
        <div className={styles.mappingHint}>
          يوجد صافي تحصيل غير منسوب بقيمة {money(unattributed.net_cash_collected_text, unattributed.currency ?? baseCurrency)}.
        </div>
      )}

      <div className={styles.tableShell}>
        <table className={styles.groupsTable} aria-label="جدول تحليل مصادر الإيراد مدى الحياة">
          <thead>
            <tr>
              <th scope="col">مصدر الإيراد</th>
              <th scope="col">النوع</th>
              <th scope="col">العملاء</th>
              <th scope="col">المعاملات</th>
              <th scope="col">إجمالي التحصيل</th>
              <th scope="col">الاسترجاعات</th>
              <th scope="col">صافي التحصيل</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const currency = row.currency ?? baseCurrency;
              return (
                <tr key={row.revenue_stream_id ?? "unattributed"}>
                  <td>
                    <strong>{row.revenue_stream_name ?? "غير منسوب"}</strong>
                    {row.is_unattributed && <small>يحتاج ربطًا يدويًا</small>}
                  </td>
                  <td dir="ltr">{streamTypeLabel(row.revenue_stream_type)}</td>
                  <td dir="ltr">{String(row.customers_with_activity)}</td>
                  <td dir="ltr">{String(row.transaction_count)}</td>
                  <td dir="ltr">{money(row.gross_cash_collected_text, currency)}</td>
                  <td dir="ltr">{money(row.refunds_text, currency)}</td>
                  <td dir="ltr"><strong>{money(row.net_cash_collected_text, currency)}</strong></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
