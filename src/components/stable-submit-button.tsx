"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import styles from "./stable-submit-button.module.css";

type StableSubmitButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "type"> & {
  children: ReactNode;
  pendingLabel: ReactNode;
};

/**
 * Keeps a server-action submit control dimensionally stable while exposing
 * pending state and preventing duplicate submissions.
 */
export function StableSubmitButton({
  children,
  pendingLabel,
  className,
  disabled,
  ...props
}: StableSubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <>
      <button
        {...props}
        type="submit"
        className={className}
        disabled={isDisabled}
        aria-busy={pending || undefined}
      >
        <span className={styles.labelStack}>
          <span className={pending ? styles.hiddenLabel : undefined} aria-hidden={pending}>
            {children}
          </span>
          <span className={!pending ? styles.hiddenLabel : undefined} aria-hidden={!pending}>
            {pendingLabel}
          </span>
        </span>
      </button>
      <span className={styles.liveStatus} role="status" aria-atomic="true">
        {pending ? pendingLabel : null}
      </span>
    </>
  );
}
