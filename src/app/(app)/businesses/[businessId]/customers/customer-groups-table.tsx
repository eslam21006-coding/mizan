"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { formatCountText, formatMoneyText } from "@/lib/financial-display";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import uxStyles from "./customer-analysis-ux.module.css";
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

type CustomerFilter = "all" | "repeat" | "single" | "refunded";
type CustomerSort = "acquisition_desc" | "last_transaction_desc" | "net_cash_desc" | "transactions_desc";

/** Escapes PostgreSQL ILIKE metacharacters so user-entered email text is matched literally. */
function escapeIlikeLiteral(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

/** Formats an optional transaction timestamp in the business reporting timezone. */
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

/** Renders the searchable, sortable customer transaction ledger without changing stored transaction semantics. */
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
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState<CustomerFilter>("all");
  const [sort, setSort] = useState<CustomerSort>("acquisition_desc");

  /** Loads one authorized customer-ledger page with the selected server-side filters and sorting. */
  const loadRows = useCallback(
    async (isActive: () => boolean = () => true) => {
      setIsLoading(true);
      setError(null);
      const supabase = createSupabaseBrowserClient();
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from("customer_transaction_groups")
        .select(
          "business_id,customer_email,acquisition_at,acquisition_date,transaction_count,collection_count,refund_count,gross_cash_collected_text,refunds_text,net_cash_collected_text,last_transaction_at,currency",
          { count: "exact" },
        )
        .eq("business_id", businessId);

      if (search) {
        query = query.ilike("customer_email", `%${escapeIlikeLiteral(search)}%`);
      }
      if (customerFilter === "repeat") query = query.gt("collection_count", 1);
      if (customerFilter === "single") query = query.eq("transaction_count", 1);
      if (customerFilter === "refunded") query = query.gt("refund_count", 0);

      if (sort === "last_transaction_desc") {
        query = query.order("last_transaction_at", { ascending: false, nullsFirst: false });
      } else if (sort === "net_cash_desc") {
        query = query.order("net_cash_collected", { ascending: false, nullsFirst: false });
      } else if (sort === "transactions_desc") {
        query = query.order("transaction_count", { ascending: false, nullsFirst: false });
      } else {
        query = query.order("acquisition_at", { ascending: false, nullsFirst: false });
      }

      const { data, error: loadError, count } = await query
        .order("customer_email", { ascending: true })
        .range(from, to);

      if (!isActive()) return;
      if (loadError) {
        setRows([]);
        setTotalCount(null);
        setError("تعذر تحميل بيانات العملاء. حاول مرة أخرى. إذا استمرت المشكلة، تحقق من تطبيق تحديثات قاعدة البيانات الخاصة بالعملاء.");
      } else {
        setRows((data ?? []) as CustomerTransactionGroup[]);
        setTotalCount(count ?? null);
      }
      setIsLoading(false);
    },
    [businessId, customerFilter, page, search, sort],
  );

  useEffect(() => {
    let active = true;
    void loadRows(() => active);
    return () => {
      active = false;
    };
  }, [loadRows]);

  const pageCount = useMemo(() => {
    if (totalCount === null) return null;
    return Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  }, [totalCount]);

  /** Applies the typed email search without issuing a request on every keystroke. */
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(0);
    setSearch(searchDraft.trim());
  };

  /** Restores the complete customer ledger and the default acquisition-date sort. */
  const clearControls = () => {
    setSearchDraft("");
    setSearch("");
    setCustomerFilter("all");
    setSort("acquisition_desc");
    setPage(0);
  };

  if (isLoading && rows.length === 0) {
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
        <button className={styles.retryButton} type="button" onClick={() => void loadRows()}>
          إعادة المحاولة
        </button>
      </section>
    );
  }

  if (rows.length === 0 && page === 0 && !search && customerFilter === "all") {
    return (
      <section className={styles.emptyPanel}>
        <span>لا توجد معاملات عملاء بعد</span>
        <h2>استورد معاملاتك لبدء تحليل العملاء</h2>
        <p>بعد الاستيراد، سيجمع ميزان كل بريد إلكتروني كعميل واحد ويحدد أول تحصيل ناجح كتاريخ أول شراء.</p>
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
          <span className={styles.kicker}>سجل العملاء</span>
          <h2 id="customer-groups-title">من دفع ومتى؟</h2>
          <p>كل بريد إلكتروني يمثل عميلًا واحدًا داخل هذا البزنس، مع عدد مرات الشراء والاسترجاعات وصافي التحصيل.</p>
        </div>
        <div className={styles.identityCount}>
          <span>النتائج</span>
          <strong>{formatCountText(totalCount ?? rows.length)}</strong>
        </div>
      </div>

      <div className={uxStyles.customerControls}>
        <form className={uxStyles.customerSearch} onSubmit={submitSearch}>
          <label htmlFor="customer-email-search">ابحث بالبريد الإلكتروني</label>
          <div>
            <input
              id="customer-email-search"
              type="search"
              dir="ltr"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.currentTarget.value)}
              placeholder="name@example.com"
            />
            <button type="submit">بحث</button>
          </div>
        </form>

        <label className={uxStyles.customerControlField}>
          <span>اعرض</span>
          <select
            value={customerFilter}
            onChange={(event) => {
              setCustomerFilter(event.currentTarget.value as CustomerFilter);
              setPage(0);
            }}
          >
            <option value="all">كل العملاء</option>
            <option value="repeat">اشتروا أكثر من مرة</option>
            <option value="single">لديهم معاملة واحدة</option>
            <option value="refunded">لديهم استرجاع</option>
          </select>
        </label>

        <label className={uxStyles.customerControlField}>
          <span>رتّب حسب</span>
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.currentTarget.value as CustomerSort);
              setPage(0);
            }}
          >
            <option value="acquisition_desc">أحدث أول شراء</option>
            <option value="last_transaction_desc">أحدث معاملة</option>
            <option value="net_cash_desc">أعلى صافي تحصيل</option>
            <option value="transactions_desc">أكبر عدد معاملات</option>
          </select>
        </label>

        <button className={uxStyles.clearCustomerControls} type="button" onClick={clearControls}>
          مسح الفلاتر
        </button>
      </div>

      {rows.length === 0 ? (
        <div className={uxStyles.noFilterResults} role="status">
          لا توجد نتائج مطابقة للبحث أو الفلتر الحالي.
        </div>
      ) : (
        <div className={styles.tableShell}>
          <table className={styles.groupsTable} aria-label="جدول العملاء ومعاملاتهم">
            <thead>
              <tr>
                <th scope="col">البريد الإلكتروني</th>
                <th scope="col">أول شراء</th>
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
                        {formatCountText(row.collection_count)} تحصيل · {formatCountText(row.refund_count)} استرجاع
                      </small>
                    </td>
                    <td>
                      {row.acquisition_at ? (
                        <>
                          <strong>{row.acquisition_date ?? "—"}</strong>
                          <small>{timestampDisplay(row.acquisition_at, timezone)}</small>
                        </>
                      ) : (
                        <span className={styles.notAcquired}>لا يوجد تحصيل ناجح بعد</span>
                      )}
                    </td>
                    <td dir="ltr">{formatCountText(row.transaction_count)}</td>
                    <td dir="ltr">{formatMoneyText(row.gross_cash_collected_text, currency)}</td>
                    <td dir="ltr">{formatMoneyText(row.refunds_text, currency)}</td>
                    <td dir="ltr">
                      <strong>{formatMoneyText(row.net_cash_collected_text, currency)}</strong>
                    </td>
                    <td>{timestampDisplay(row.last_transaction_at, timezone)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <nav className={styles.pagination} aria-label="التنقل بين صفحات العملاء">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage((current) => Math.max(0, current - 1))}
        >
          الصفحة السابقة
        </button>
        <span>
          الصفحة {formatCountText(page + 1)}
          {pageCount !== null ? ` من ${formatCountText(pageCount)}` : ""}
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
