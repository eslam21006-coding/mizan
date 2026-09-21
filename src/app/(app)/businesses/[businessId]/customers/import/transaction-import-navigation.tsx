import Link from "next/link";
import { Breadcrumb } from "@/components/navigation-hierarchy";
import type { TransactionImportReturnOrigin } from "@/lib/transaction-import-navigation";
import { transactionImportReturnAction } from "@/lib/transaction-import-navigation";
import styles from "./transaction-import.module.css";

type TransactionImportNavigationProps = {
  businessId: string;
  businessName: string;
  returnOrigin: TransactionImportReturnOrigin | null;
};

/** Shows Import's deterministic hierarchy plus an origin-aware, allow-listed Cancel action. */
export function TransactionImportNavigation({
  businessId,
  businessName,
  returnOrigin,
}: TransactionImportNavigationProps) {
  const cancelAction = transactionImportReturnAction(returnOrigin, businessId);

  return (
    <div className={styles.importNavigation}>
      <Breadcrumb
        ariaLabel="مسار استيراد معاملات العملاء"
        items={[
          { label: "البزنسات", destination: { route: "businesses" } },
          {
            label: businessName,
            destination: { route: "business-overview", businessId },
          },
          {
            label: "العملاء وقيمة العميل",
            destination: { route: "business-customers", businessId },
          },
          { label: "استيراد المعاملات", current: true },
        ]}
      />
      <Link className={styles.cancelLink} href={cancelAction.href}>
        إلغاء الاستيراد
      </Link>
    </div>
  );
}
