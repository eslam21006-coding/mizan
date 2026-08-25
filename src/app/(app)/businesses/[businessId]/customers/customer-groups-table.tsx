"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./customer-groups.module.css";

const PAGE_SIZE = 50;

type CustomerTransactionGroup = {
  business_id: string;
  customer_email: string;
  acquisition_at: string | null;
  acquisition_date: string | null;
  transaction_count: number | string;
  collection_count: number | string;
  refund_count: number | string;
  gross_cash_collected_text: string;
  refunds_text: string;
  net_cash_collected_text: string;
  last_transaction_at: string | null;
  currency: string | null;
};

type CustomerGroupsTableProps = {
  businessId: string;
  baseCurrency: string;
  timezone: string;
};

function exactDisplay(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "—";
  return String(value);
}

function moneyDisplay(value: string, currency: string) {
  return `${value} ${currency}`;
}

function timestampDisplay(value: string | null, timezone: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date);
}

export function CustomerGroupsTable({
  businessId,
  baseCurrency,
  timezone,
}: CustomerGroupsTableProps) {
  const [rows, setRows] = useState<CustomerTransactionGroup[]>([]);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      const supabase = createSupabaseBrowserClient();
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error: loadError, count } = await supabase
        .from("customer_transaction_groups")
        .select(
          "business_id,customer_email,acquisition_at,acquisition_date,transaction_count,collection_count,refund_count,gross_cash_collected_text,refunds_text,net_cash_collected_text,last_transaction_at,currency",
          { count: "exact" },
        )
        .eq("business_id", businessId)
        .order("acquisition_at", { ascending: false, nullsFirst: false })
        .order("customer_email", { ascending: true })
        .range(from, to);

      if (!active) return;
      if (loadError) {
        setRows([]);
        setTotalCount(null);
        setError("تعذر تحميل بيانات العملاء. حاول مرة أخرى. إذا استمرت المشكلة، تحقق من تطبيق تحديثات قاعدة البيانات الخاصة بالعملاء.");
      } else {
        setRows((data ?? []) as CustomerTransactionGroup[]);
        setTotalCount(count ?? null);
      }
      setIsLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [businessId, page, reloadToken]);

  const pageCount = useMemo(() => {
    if (totalCount === null) return null;
    return Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  }, [totalCount]);

  if (isLoading) {
    return (
      <section className={styles.statusPanel} role="status" aria-live="polite">
        جاري تحميل العملاء…
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.errorPanel} role="alert">
        <strong>تعذر تحميل العملاء</strong>
        <p>{error}</p>
        <button className={styles.retryButton} type="button" onClick={() => setReloadToken((current) => current + 1)}>
          إعادة المحاولة
        </button>
      </section>
    );
  }

  if (rows.length === 0 && page === 0) {
    return (
      <section className={styles.emptyPanel}>
        <span>لا توجد معاملات عملاء بعد</span>
        <h2>استورد معاملاتك لبدء تحليل العملاء</h2>
        <p>بعد الاستيراد، سيجمع ميزان كل بريد إلكتروني كعميل واحد ويحدد أول تحصيل ناجح كتاريخ اكتساب.</p>
        <div className={styles.emptyActions}>
          <Link className={styles.emptyAction} href={`/businesses/${businessId}/customers/import`}>
            استيراد معاملات
          </Link>
          <a
            className={styles.emptyAction}
            href="/mizan-transactions-template.csv"
            download="mizan-transactions-template.csv"
          >
            تنزيل نموذج CSV
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.groupPanel} aria-labelledby="customer-groups-title">
      <div className={styles.groupHeading}>
        <div>
          <span className={styles.kicker}>العملاء</span>
          <h2 id="customer-groups-title">العملاء</h2>
          <p>يُجمع كل بريد إلكتروني كعميل واحد داخل هذا البزنس، مع إبقاء التحصيلات والاسترجاعات منفصلة وواضحة.</p>
        </div>
        <div className={styles.identityCount}>
          <span>عدد العملاء</span>
          <strong>{totalCount ?? rows.length}</strong>
        </div>
      </div>

      <div className={styles.tableShell}>
        <table className={styles.groupsTable} aria-label="جدول العملاء ومعاملاتهم">
          <thead>
            <tr>
              <th scope="col">العميل</th>
              <th scope="col">تاريخ الاكتساب</th>
              <th scope="col">المعاملات</th>
              <th scope="col">إجمالي التحصيل</th>
              <th scope="col">الاسترجاعات</th>
              <th scope="col">صافي التحصيل</th>
              <th scope="col">آخر معاملة</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const currency = row.currency ?? baseCurrency;
              return (
                <tr key={`${row.business_id}:${row.customer_email}`}>
                  <td>
                    <strong dir="ltr">{row.customer_email}</strong>
                    <small>
                      {exactDisplay(row.collection_count)} تحصيل · {exactDisplay(row.refund_count)} استرجاع
                    </small>
                  </td>
                  <td>
                    {row.acquisition_at ? (
                      <>
                        <strong>{row.acquisition_date ?? "—"}</strong>
                        <small>{timestampDisplay(row.acquisition_at, timezone)}</small>
                      </>
                    ) : (
                      <span className={styles.notAcquired}>لم يتم اكتساب العميل بعد</span>
                    )}
                  </td>
                  <td dir="ltr">{exactDisplay(row.transaction_count)}</td>
                  <td dir="ltr">{moneyDisplay(row.gross_cash_collected_text, currency)}</td>
                  <td dir="ltr">{moneyDisplay(row.refunds_text, currency)}</td>
                  <td dir="ltr">
                    <strong>{moneyDisplay(row.net_cash_collected_text, currency)}</strong>
                  </td>
                  <td>{timestampDisplay(row.last_transaction_at, timezone)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <nav className={styles.pagination} aria-label="التنقل بين صفحات العملاء">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage((current) => Math.max(0, current - 1))}
        >
          الصفحة السابقة
        </button>
        <span>
          الصفحة {page + 1}
          {pageCount !== null ? ` من ${pageCount}` : ""}
        </span>
        <button
          type="button"
          disabled={pageCount !== null ? page + 1 >= pageCount : rows.length < PAGE_SIZE}
          onClick={() => setPage((current) => current + 1)}
        >
          الصفحة التالية
        </button>
      </nav>
    </section>
  );
}
