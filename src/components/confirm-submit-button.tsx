"use client";

import type { ReactNode } from "react";

type ConfirmSubmitButtonProps = {
  children: ReactNode;
  confirmMessage: string;
  className?: string;
  ariaLabel?: string;
};

export function ConfirmSubmitButton({
  children,
  confirmMessage,
  className,
  ariaLabel,
}: ConfirmSubmitButtonProps) {
  return (
    <button
      type="submit"
      formNoValidate
      className={className}
      aria-label={ariaLabel}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
