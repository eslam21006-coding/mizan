"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "../lifetime-economics.module.css";

const PAGE_SIZE = 50;

type Stream = {
  id: string;
  name: string;
  stream_type: "front_end" | "backend" | "other";
  is_active: boolean;
};

type Transaction = {
  id: string;
  customer_email: string;
  transaction_at: string;
  transaction_type: "collection" | "refund";
  amount_collected_text: string;
  currency: string;
  source: string;
  source_transaction_id: string | null;
  revenue_stream_id: string | null;
  revenue_stream_name_snapshot: string | null;
};

type Props = {
  businessId: string;
  baseCurrency: string;
  canManage: boolean;
};

export function RevenueStreamAttributionManager({ businessId, baseCurrency, canManage }: Props) {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const [streamResult, transactionResult] = await Promise.all([
      supabase
        .from("revenue_streams")
        .select("id,name,stream_type,is_active")
        .eq("business_id", businessId)
        .order("name"),
      supabase
        .from("customer_transaction_revenue_stream_attribution")
        .select(
          "id,customer_email,transaction_at,transaction_type,amount_collected_text,currency,source,source_transaction_id,revenue_stream_id,revenue_stream_name_snapshot",
          { count: "exact" },
        )
        .eq("business_id", businessId)
        .order("transaction_at", { ascending: false })
        .range(from, to),
    ]);

    if (streamResult.error || transactionResult.error) {
      setStreams([]);
      setTransactions([]);
      setError("تعذر تحميل المعاملات أو مصادر الإيراد. أعد المحاولة.");
    } else {
      setStreams((streamResult.data ?? []) as Stream[]);
      const loaded = (transactionResult.data ?? []) as Transaction[];
      setTransactions(loaded);
      setTotalCount(transactionResult.count ?? loaded.length);
      setSelections(Object.fromEntries(loaded.map((row) => [row.id, row.revenue_stream_id ?? ""])));
    }
    setIsLoading(false);
  }, [businessId, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)), [totalCount]);

  const save = async (transaction: Transaction) => {
    if (!canManage || savingId) return;
    setSavingId(transaction.id);
    setError(null);
    const selected = selections[transaction.id] ?? "";
    const supabase = createSupabaseBrowserClient();
    const { error: saveError } = await supabase.rpc("assign_customer_transaction_revenue_stream", {
      p_business_id: businessId,
      p_transaction_id: transaction.id,
      p_revenue_stream_id: selected || null,
    });
    if (saveError) {
      setError("تعذر حفظ ربط مصدر الإيراد. تأكد من صلاحيتك ثم أعد المحاولة.");
    } else {
      await load();
    }
    setSavingId(null);
  };

  if (isLoading) return <section className={styles.managerPanel}>جاري تحميل المعاملات…</section>;

  return (
    <section className={styles.managerPanel} aria-labelledby="attribution-manager-title">
      <div className={styles.managerHeader}>
        <div>
          <h2 id="attribution-manager-title">المعاملات المحفوظة</h2>
          <p>يمكن ترك المعاملة غير منسوبة. ستظل ظاهرة بوضوح داخل التحليل بدل تخمين مصدرها.</p>
        </div>
        <strong>{totalCount} معاملة</strong>
      </div>

      {!canManage && <div className={styles.notice}>يمكنك عرض الربط فقط. التعديل متاح لمالك البزنس أو الأدمن.</div>}
      {error && <div className={styles.error} role="alert">{error}</div>}
      {streams.length === 0 && (
        <div className={styles.notice}>لا توجد مصادر إيراد في هذا البزنس. أنشئ مصدر إيراد أولًا من إعدادات البزنس.</div>
      )}

      <div className={styles.tableShell}>
        <table className={styles.table} aria-label="ربط معاملات العملاء بمصادر الإيراد">
          <thead>
            <tr>
              <th>العميل</th>
              <th>التاريخ</th>
              <th>المعاملة</th>
              <th>القيمة</th>
              <th>مصدر الإيراد</th>
              <th>حفظ</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr key={transaction.id}>
                <td dir="ltr">{transaction.customer_email}</td>
                <td dir="ltr">{transaction.transaction_at.slice(0, 10)}</td>
                <td>{transaction.transaction_type === "collection" ? "تحصيل" : "استرجاع"}</td>
                <td dir="ltr">{transaction.amount_collected_text} {transaction.currency || baseCurrency}</td>
                <td>
                  <select
                    aria-label={`مصدر إيراد ${transaction.customer_email} ${transaction.id}`}
                    value={selections[transaction.id] ?? ""}
                    disabled={!canManage || savingId === transaction.id}
                    onChange={(event) =>
                      setSelections((current) => ({ ...current, [transaction.id]: event.currentTarget.value }))
                    }
                  >
                    <option value="">غير منسوب</option>
                    {streams.map((stream) => (
                      <option key={stream.id} value={stream.id}>
                        {stream.name}{stream.is_active ? "" : " — غير نشط"}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    disabled={!canManage || savingId === transaction.id}
                    onClick={() => void save(transaction)}
                  >
                    {savingId === transaction.id ? "جاري الحفظ…" : "حفظ"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {transactions.length === 0 && <div className={styles.notice}>لا توجد معاملات محفوظة بعد.</div>}

      <nav className={styles.pagination} aria-label="صفحات ربط المعاملات">
        <button type="button" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>
          الصفحة السابقة
        </button>
        <span>الصفحة {page + 1} من {pageCount}</span>
        <button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage((current) => current + 1)}>
          الصفحة التالية
        </button>
      </nav>
    </section>
  );
}
