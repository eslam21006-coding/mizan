"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatCountText, formatMoneyText } from "@/lib/financial-display";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./customer-detail-drawer.module.css";

export type CustomerDetailSummary = {
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

type CustomerTransactionRow = {
  id: string;
  source: string;
  source_transaction_id: string | null;
  transaction_date: string;
  transaction_at: string;
  amount_collected: number | string;
  transaction_type: "collection" | "refund";
  currency: string;
  revenue_stream_name_snapshot: string | null;
  revenue_stream_type_snapshot: "front_end" | "backend" | "other" | null;
  created_at: string;
};

type CustomerDetailDrawerProps = {
  businessId: string;
  baseCurrency: string;
  timezone: string;
  customer: CustomerDetailSummary | null;
  opener: HTMLButtonElement | null;
  onDismiss: () => void;
};

const DRAWER_ID = "customer-detail-drawer";
const DRAWER_TITLE_ID = "customer-detail-drawer-title";
const TRANSACTION_PAGE_SIZE = 50;

/** Formats one stored transaction timestamp in the business reporting timezone. */
function timestampDisplay(value: string, timezone: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date);
}

/** Converts stored revenue-stream types into concise Arabic detail labels. */
function revenueStreamTypeLabel(value: CustomerTransactionRow["revenue_stream_type_snapshot"]) {
  if (value === "front_end") return "Front-End";
  if (value === "backend") return "Backend";
  if (value === "other") return "مصدر آخر";
  return null;
}

/** Keeps one customer's aggregate facts and transaction history inside the current ledger context. */
export function CustomerDetailDrawer({
  businessId,
  baseCurrency,
  timezone,
  customer,
  opener,
  onDismiss,
}: CustomerDetailDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const requestIdRef = useRef(0);
  const [transactions, setTransactions] = useState<CustomerTransactionRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Loads the complete RLS-scoped history in bounded pages and ignores superseded responses. */
  const loadTransactions = useCallback(
    async (targetCustomer: CustomerDetailSummary) => {
      const requestId = ++requestIdRef.current;
      setTransactions([]);
      setError(null);
      setIsLoading(true);

      const supabase = createSupabaseBrowserClient();
      const loadedTransactions: CustomerTransactionRow[] = [];

      for (let from = 0; ; from += TRANSACTION_PAGE_SIZE) {
        const { data, error: loadError } = await supabase
          .from("customer_transactions")
          .select(
            "id,source,source_transaction_id,transaction_date,transaction_at,amount_collected,transaction_type,currency,revenue_stream_name_snapshot,revenue_stream_type_snapshot,created_at",
          )
          .eq("business_id", businessId)
          .eq("customer_email", targetCustomer.customer_email)
          .order("transaction_at", { ascending: false })
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, from + TRANSACTION_PAGE_SIZE - 1);

        if (requestId !== requestIdRef.current) return;
        if (loadError) {
          setTransactions([]);
          setError("تعذر تحميل سجل معاملات هذا العميل. حاول مرة أخرى.");
          setIsLoading(false);
          return;
        }

        const pageRows = (data ?? []) as CustomerTransactionRow[];
        loadedTransactions.push(...pageRows);
        if (pageRows.length < TRANSACTION_PAGE_SIZE) break;
      }

      if (requestId !== requestIdRef.current) return;
      setTransactions(loadedTransactions);
      setIsLoading(false);
    },
    [businessId],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!customer) {
      requestIdRef.current += 1;
      if (dialog?.open) dialog.close();
      return;
    }

    if (dialog && !dialog.open) dialog.showModal();
    void loadTransactions(customer);

    return () => {
      requestIdRef.current += 1;
    };
  }, [customer, loadTransactions]);

  /** Clears the selected customer and restores keyboard focus to the row action that opened the drawer. */
  function handleClose() {
    onDismiss();
    queueMicrotask(() => opener?.focus());
  }

  const customerCurrency = customer?.currency ?? baseCurrency;

  return (
    <dialog
      ref={dialogRef}
      id={DRAWER_ID}
      className={styles.drawer}
      aria-labelledby={DRAWER_TITLE_ID}
      onClose={handleClose}
    >
      {customer ? (
        <div className={styles.drawerShell}>
          <header className={styles.drawerHeader}>
            <div className={styles.identity}>
              <span className={styles.kicker}>تفاصيل العميل</span>
              <h2 id={DRAWER_TITLE_ID}>{customer.customer_name ?? customer.customer_email}</h2>
              {customer.customer_name ? <p dir="ltr">{customer.customer_email}</p> : null}
            </div>
            <form method="dialog">
              <button type="submit" className={styles.closeButton} aria-label="إغلاق تفاصيل العميل">
                ×
              </button>
            </form>
          </header>

          <div className={styles.drawerBody}>
            <section className={styles.summarySection} aria-labelledby="customer-detail-summary-title">
              <div className={styles.sectionHeading}>
                <div>
                  <span className={styles.kicker}>ملخص العميل</span>
                  <h3 id="customer-detail-summary-title">الصورة المالية حتى الآن</h3>
                </div>
                <span className={styles.acquisitionDate}>
                  أول شراء: {customer.acquisition_date ?? "لا يوجد تحصيل ناجح"}
                </span>
              </div>

              <div className={styles.summaryGrid}>
                <article>
                  <span>المعاملات</span>
                  <strong>{formatCountText(customer.transaction_count)}</strong>
                  <small>
                    {formatCountText(customer.collection_count)} تحصيل · {formatCountText(customer.refund_count)} استرجاع
                  </small>
                </article>
                <article>
                  <span>إجمالي التحصيل</span>
                  <strong dir="ltr">{formatMoneyText(customer.gross_cash_collected_text, customerCurrency)}</strong>
                </article>
                <article>
                  <span>الاسترجاعات</span>
                  <strong dir="ltr">{formatMoneyText(customer.refunds_text, customerCurrency)}</strong>
                </article>
                <article>
                  <span>صافي التحصيل</span>
                  <strong dir="ltr">{formatMoneyText(customer.net_cash_collected_text, customerCurrency)}</strong>
                </article>
              </div>
            </section>

            <section className={styles.historySection} aria-labelledby="customer-detail-history-title">
              <div className={styles.sectionHeading}>
                <div>
                  <span className={styles.kicker}>السجل</span>
                  <h3 id="customer-detail-history-title">سجل المعاملات</h3>
                </div>
                {!isLoading && !error ? <span>{formatCountText(transactions.length)} معاملة</span> : null}
              </div>

              {isLoading ? (
                <div className={styles.statusPanel} role="status" aria-live="polite">
                  جاري تحميل سجل المعاملات…
                </div>
              ) : error ? (
                <div className={styles.errorPanel} role="alert">
                  <strong>تعذر تحميل السجل</strong>
                  <p>{error}</p>
                  <button type="button" onClick={() => void loadTransactions(customer)}>
                    إعادة المحاولة
                  </button>
                </div>
              ) : transactions.length === 0 ? (
                <div className={styles.statusPanel} role="status">
                  لا توجد معاملات متاحة لهذا العميل.
                </div>
              ) : (
                <div className={styles.transactionList}>
                  {transactions.map((transaction) => {
                    const isRefund = transaction.transaction_type === "refund";
                    const amountText = `${isRefund ? "-" : ""}${String(transaction.amount_collected)}`;
                    const streamType = revenueStreamTypeLabel(transaction.revenue_stream_type_snapshot);
                    return (
                      <article className={styles.transactionCard} key={transaction.id}>
                        <div className={styles.transactionTop}>
                          <div>
                            <span className={isRefund ? styles.refundTag : styles.collectionTag}>
                              {isRefund ? "استرجاع" : "تحصيل"}
                            </span>
                            <strong>{timestampDisplay(transaction.transaction_at, timezone)}</strong>
                            <small>{transaction.transaction_date}</small>
                          </div>
                          <strong className={isRefund ? styles.refundAmount : styles.collectionAmount} dir="ltr">
                            {formatMoneyText(amountText, transaction.currency)}
                          </strong>
                        </div>

                        <div className={styles.transactionMeta}>
                          <span>
                            المصدر: <b dir="auto">{transaction.source}</b>
                          </span>
                          {transaction.revenue_stream_name_snapshot ? (
                            <span>
                              مصدر الإيراد: <b>{transaction.revenue_stream_name_snapshot}</b>
                              {streamType ? ` · ${streamType}` : ""}
                            </span>
                          ) : null}
                          {transaction.source_transaction_id ? (
                            <span>
                              مرجع المعاملة: <b dir="ltr">{transaction.source_transaction_id}</b>
                            </span>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
