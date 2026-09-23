"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { formatCountText, formatMoneyText } from "@/lib/financial-display";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import uxStyles from "./customer-analysis-ux.module.css";
import { CustomerDetailDrawer } from "./customer-detail-drawer";
import detailStyles from "./customer-detail-drawer.module.css";
import styles from "./customer-groups.module.css";

const PAGE_SIZE = 50;
const CUSTOMER_PAGE_PARAM = "customerPage";
const SEARCH_PARAM = "search";
const FILTER_PARAM = "filter";
const SORT_PARAM = "sort";

type CustomerTransactionGroup = {
  business_id: string;
  customer_email: string;
  customer_name: string | null;
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
type NavigationMode = "push" | "replace";

type CustomerUrlStateUpdate = {
  search?: string;
  filter?: CustomerFilter;
  sort?: CustomerSort;
  page?: number;
};

/** Escapes PostgreSQL ILIKE metacharacters so user-entered customer search text is matched literally. */
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

/** Returns one unambiguous query value or null when the parameter is missing or duplicated. */
function singleSearchParam(searchParams: URLSearchParams, key: string) {
  const values = searchParams.getAll(key);
  return values.length === 1 ? values[0] : null;
}

/** Parses the customer-ledger page from a 1-based URL value. */
function parseCustomerPage(searchParams: URLSearchParams) {
  const raw = singleSearchParam(searchParams, CUSTOMER_PAGE_PARAM);
  if (!raw) return 0;
  const pageNumber = Number(raw);
  return Number.isSafeInteger(pageNumber) && pageNumber >= 1 ? pageNumber - 1 : 0;
}

/** Parses the customer search text while treating duplicate query values as invalid. */
function parseCustomerSearch(searchParams: URLSearchParams) {
  return singleSearchParam(searchParams, SEARCH_PARAM)?.trim() ?? "";
}

/** Parses a supported customer filter and safely falls back to all customers. */
function parseCustomerFilter(searchParams: URLSearchParams): CustomerFilter {
  const candidate = singleSearchParam(searchParams, FILTER_PARAM);
  return candidate === "repeat" || candidate === "single" || candidate === "refunded" ? candidate : "all";
}

/** Parses a supported customer sort and safely falls back to latest acquisition. */
function parseCustomerSort(searchParams: URLSearchParams): CustomerSort {
  const candidate = singleSearchParam(searchParams, SORT_PARAM);
  return candidate === "last_transaction_desc" || candidate === "net_cash_desc" || candidate === "transactions_desc"
    ? candidate
    : "acquisition_desc";
}

/** Renders the searchable, sortable customer transaction ledger without changing stored transaction semantics. */
export function CustomerGroupsTable({
  businessId,
  baseCurrency,
  timezone,
}: CustomerGroupsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const readonlySearchParams = useSearchParams();
  const parsedSearchParams = useMemo(
    () => new URLSearchParams(readonlySearchParams.toString()),
    [readonlySearchParams],
  );
  const page = parseCustomerPage(parsedSearchParams);
  const search = parseCustomerSearch(parsedSearchParams);
  const customerFilter = parseCustomerFilter(parsedSearchParams);
  const sort = parseCustomerSort(parsedSearchParams);
  const listQueryKey = JSON.stringify([search, customerFilter, sort]);

  const [rows, setRows] = useState<CustomerTransactionGroup[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [totalCountQueryKey, setTotalCountQueryKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState(search);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerTransactionGroup | null>(null);
  const detailOpenerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  /** Updates only customer-ledger URL state while preserving Customer view and unrelated structured query parameters. */
  const updateCustomerUrlState = useCallback(
    (updates: CustomerUrlStateUpdate, mode: NavigationMode = "push") => {
      const params = new URLSearchParams(readonlySearchParams.toString());

      if (updates.search !== undefined) {
        const value = updates.search.trim();
        if (value) params.set(SEARCH_PARAM, value);
        else params.delete(SEARCH_PARAM);
      }
      if (updates.filter !== undefined) {
        if (updates.filter === "all") params.delete(FILTER_PARAM);
        else params.set(FILTER_PARAM, updates.filter);
      }
      if (updates.sort !== undefined) {
        if (updates.sort === "acquisition_desc") params.delete(SORT_PARAM);
        else params.set(SORT_PARAM, updates.sort);
      }
      if (updates.page !== undefined) {
        const safePage = Math.max(0, updates.page);
        if (safePage === 0) params.delete(CUSTOMER_PAGE_PARAM);
        else params.set(CUSTOMER_PAGE_PARAM, String(safePage + 1));
      }

      const query = params.toString();
      const href = query ? `${pathname}?${query}` : pathname;
      if (mode === "replace") router.replace(href);
      else router.push(href);
    },
    [pathname, readonlySearchParams, router],
  );

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
          "business_id,customer_email,customer_name,acquisition_at,acquisition_date,transaction_count,collection_count,refund_count,gross_cash_collected_text,refunds_text,net_cash_collected_text,last_transaction_at,currency",
          { count: "exact" },
        )
        .eq("business_id", businessId);

      if (search) {
        query = query.ilike("customer_search_text", `%${escapeIlikeLiteral(search)}%`);
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
        setTotalCountQueryKey(null);
        setError("تعذر تحميل بيانات العملاء. حاول مرة أخرى. إذا استمرت المشكلة، تحقق من تطبيق تحديثات قاعدة البيانات الخاصة بالعملاء.");
      } else {
        setRows((data ?? []) as CustomerTransactionGroup[]);
        setTotalCount(count ?? null);
        setTotalCountQueryKey(listQueryKey);
      }
      setIsLoading(false);
    },
    [businessId, customerFilter, listQueryKey, page, search, sort],
  );

  useEffect(() => {
    let active = true;
    void loadRows(() => active);
    return () => {
      active = false;
    };
  }, [loadRows]);

  const activeTotalCount = totalCountQueryKey === listQueryKey ? totalCount : null;
  const pageCount = useMemo(() => {
    if (activeTotalCount === null) return null;
    return Math.max(1, Math.ceil(activeTotalCount / PAGE_SIZE));
  }, [activeTotalCount]);

  useEffect(() => {
    if (pageCount !== null && page >= pageCount) {
      updateCustomerUrlState({ page: pageCount - 1 }, "replace");
    }
  }, [page, pageCount, updateCustomerUrlState]);

  /** Applies the typed customer name-or-email search without issuing a request on every keystroke. */
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateCustomerUrlState({ search: searchDraft, page: 0 });
  };

  /** Restores the complete customer ledger and the default acquisition-date sort without disturbing other Customer state. */
  const clearControls = () => {
    setSearchDraft("");
    updateCustomerUrlState({ search: "", filter: "all", sort: "acquisition_desc", page: 0 });
  };

  /** Opens one customer's detail drawer while retaining the current list URL and focused row action. */
  function openCustomerDetails(customer: CustomerTransactionGroup, opener: HTMLButtonElement) {
    detailOpenerRef.current = opener;
    setSelectedCustomer(customer);
  }

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
          <strong>{formatCountText(activeTotalCount ?? rows.length)}</strong>
        </div>
      </div>

      <div className={uxStyles.customerControls}>
        <form className={uxStyles.customerSearch} onSubmit={submitSearch}>
          <label htmlFor="customer-search">ابحث بالاسم أو البريد الإلكتروني</label>
          <div>
            <input
              id="customer-search"
              type="search"
              dir="auto"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.currentTarget.value)}
              placeholder="الاسم أو البريد الإلكتروني"
            />
            <button type="submit">بحث</button>
          </div>
        </form>

        <label className={uxStyles.customerControlField}>
          <span>اعرض</span>
          <select
            value={customerFilter}
            onChange={(event) =>
              updateCustomerUrlState({ filter: event.currentTarget.value as CustomerFilter, page: 0 })
            }
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
            onChange={(event) =>
              updateCustomerUrlState({ sort: event.currentTarget.value as CustomerSort, page: 0 })
            }
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
        <div className={uxStyles.noFilterResults}>
          <div role="status">
            <strong>لا توجد نتائج مطابقة للبحث أو الفلتر الحالي</strong>
            <span>هذا لا يعني أن سجل العملاء فارغ؛ القيود الحالية فقط لم تُرجع أي عميل.</span>
          </div>
          <button type="button" onClick={clearControls}>
            مسح البحث والفلاتر
          </button>
        </div>
      ) : (
        <div className={styles.tableShell}>
          <table className={styles.groupsTable} aria-label="جدول العملاء ومعاملاتهم">
            <thead>
              <tr>
                <th scope="col">العميل</th>
                <th scope="col">أول شراء</th>
                <th scope="col">المعاملات</th>
                <th scope="col">إجمالي التحصيل</th>
                <th scope="col">الاسترجاعات</th>
                <th scope="col">صافي التحصيل</th>
                <th scope="col">آخر معاملة</th>
                <th scope="col">التفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const currency = row.currency ?? baseCurrency;
                return (
                  <tr key={`${row.business_id}:${row.customer_email}`}>
                    <td>
                      {row.customer_name ? (
                        <>
                          <strong>{row.customer_name}</strong>
                          <small dir="ltr">{row.customer_email}</small>
                        </>
                      ) : (
                        <strong dir="ltr">{row.customer_email}</strong>
                      )}
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
                    <td>
                      <button
                        type="button"
                        className={detailStyles.rowAction}
                        aria-haspopup="dialog"
                        aria-controls="customer-detail-drawer"
                        aria-label={`عرض تفاصيل العميل ${row.customer_name ?? row.customer_email}`}
                        onClick={(event) => openCustomerDetails(row, event.currentTarget)}
                      >
                        عرض التفاصيل
                      </button>
                    </td>
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
          onClick={() => updateCustomerUrlState({ page: page - 1 })}
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
          onClick={() => updateCustomerUrlState({ page: page + 1 })}
        >
          الصفحة التالية
        </button>
      </nav>

      <CustomerDetailDrawer
        businessId={businessId}
        baseCurrency={baseCurrency}
        timezone={timezone}
        customer={selectedCustomer}
        opener={detailOpenerRef.current}
        onDismiss={() => setSelectedCustomer(null)}
      />
    </section>
  );
}
