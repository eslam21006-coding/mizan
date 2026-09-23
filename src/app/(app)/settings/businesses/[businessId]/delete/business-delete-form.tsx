"use client";

import { useState } from "react";
import { StableSubmitButton } from "@/components/stable-submit-button";
import { isBusinessDeletionConfirmation } from "@/lib/business/business-deletion";
import { deleteBusiness } from "./actions";
import styles from "./business-delete.module.css";

type BusinessDeleteFormProps = {
  businessId: string;
  businessName: string;
};

export function BusinessDeleteForm({ businessId, businessName }: BusinessDeleteFormProps) {
  const [confirmation, setConfirmation] = useState("");
  const isConfirmed = isBusinessDeletionConfirmation(confirmation);

  return (
    <form action={deleteBusiness} className={styles.deleteForm}>
      <input type="hidden" name="business_id" value={businessId} />

      <label className={styles.confirmationField}>
        <span>للتأكيد اكتب «حذف» أو «Delete»</span>
        <input
          autoComplete="off"
          name="confirmation"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder="حذف أو Delete"
          aria-describedby="business-delete-warning"
        />
      </label>

      <StableSubmitButton
        className={styles.deleteButton}
        disabled={!isConfirmed}
        pendingLabel="جارٍ حذف البزنس…"
      >
        حذف {businessName}
      </StableSubmitButton>
    </form>
  );
}
