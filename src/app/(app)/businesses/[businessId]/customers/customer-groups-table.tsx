"use client";

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
  gross_cash_collected: number | string;
  refunds: number | string;
  net_cash_collected: number | string;
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

function moneyDisplay(value: number | string, currency: string) {
  return `${exactDisplay(value)} ${currency}`;
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
          "business_id,customer_email,acquisition_at,acquisition_date,transaction_count,collection_count,refund_count,gross_cash_collected,refunds,net_cash_collected,last_transaction_at,currency",
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
        setError("تعذر تحميل تجميع العملاء. لم يتم تغيير أي بيانات. أعد تحميل الصفحة وحاول مرة أخرى.");
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
  }, [businessId, page]);

  const pageCount = useMemo(() => {
    if (totalCount === null) return null;
    return Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  }, [totalCount]);

  if (isLoading) {
    return (
      <section className={styles.statusPanel} role="status" aria-live="polite">
        جاري تجميع معاملات العملاء…
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.errorPanel} role="alert">
        <strong>تعذر تحميل العملاء</strong>
        <p>{error}</p>
      </section>
    );
  }

  if (rows.length === 0 && page === 0) {
    return (
      <section className={styles.emptyPanel}>
        <span>لا توجد معاملات محفوظة بعد</span>
        <h2>ابدأ باستيراد معاملات العملاء</h2>
        <p>
          بعد حفظ معاملات ناجحة، سيجمع Mizan كل بريد عميل مُطبّع داخل هذا البزنس ويحدد أول Collection ناجحة
          كتاريخ اكتساب.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.groupPanel} aria-labelledby="customer-groups-title">
      <div className={styles.groupHeading}>
        <div>
          <span className={styles.kicker}>Task 21 · Customer Identity</span>
          <h2 id="customer-groups-title">تجميع العملاء من سجل المعاملات</h2>
          <p>
            كل بريد مُطبّع داخل هذا البزنس يمثل هوية عميل واحدة. الأرقام أدناه حقائق من سجل المعاملات وليست
            LTV.
          </p>
        </div>
        <div className={styles.identityCount}>
          <span>هويات العملاء</span>
          <strong>{totalCount ?? rows.length}</strong>
        </div>
      </div>

      <div className={styles.tableShell}>
        <table className={styles.groupsTable} aria-label="جدول تجميع معاملات العملاء">
          <thead>
            <tr>
              <th scope="col">العميل</th>
              <th scope="col">الاكتساب</th>
              <th scope="col">المعاملات</th>
              <th scope="col">Gross Cash</th>
              <th scope="col">Refunds</th>
              <th scope="col">Net Cash</th>
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
                      {exactDisplay(row.collection_count)} Collections · {exactDisplay(row.refund_count)} Refunds
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
                  <td dir="ltr">{moneyDisplay(row.gross_cash_collected, currency)}</td>
                  <td dir="ltr">{moneyDisplay(row.refunds, currency)}</td>
                  <td dir="ltr">
                    <strong>{moneyDisplay(row.net_cash_collected, currency)}</strong>
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
