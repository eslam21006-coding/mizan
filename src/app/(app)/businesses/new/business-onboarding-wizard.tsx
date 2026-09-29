"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  CURRENCY_OPTIONS,
  TIMEZONE_OPTIONS,
  normalizeTimeZone,
  type SupportedCurrency,
} from "@/lib/business/onboarding";
import { createBusiness } from "./actions";
import styles from "./onboarding.module.css";

type BusinessOnboardingWizardProps = {
  creationRequestId: string;
  serverError?: string | null;
};

/** Renders the compact B05 business-identity creation form. */
export function BusinessOnboardingWizard({
  creationRequestId,
  serverError,
}: BusinessOnboardingWizardProps) {
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<SupportedCurrency | "">("");
  const [timezone, setTimezone] = useState("");
  const [isTimezoneEditing, setIsTimezoneEditing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const normalized = normalizeTimeZone(detected);

    if (normalized) {
      setTimezone(normalized);
      return;
    }

    setIsTimezoneEditing(true);
  }, []);

  const timezoneOptions = useMemo(() => {
    if (!timezone || TIMEZONE_OPTIONS.some((option) => option.value === timezone)) {
      return TIMEZONE_OPTIONS;
    }

    return [{ value: timezone, label: `المنطقة الحالية — ${timezone}` }, ...TIMEZONE_OPTIONS];
  }, [timezone]);

  const timezoneLabel =
    TIMEZONE_OPTIONS.find((option) => option.value === timezone)?.label ?? timezone;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    setLocalError(null);

    if (name.trim().length === 0) {
      event.preventDefault();
      setLocalError("اكتب اسم البزنس.");
      return;
    }

    if (!currency) {
      event.preventDefault();
      setLocalError("اختر العملة الأساسية.");
      return;
    }

    if (!timezone) {
      event.preventDefault();
      setLocalError("اختر المنطقة الزمنية.");
      return;
    }

    setIsSubmitting(true);
  }

  return (
    <section className={styles.wizard} aria-labelledby="business-onboarding-title">
      <div className={styles.heading}>
        <span className={styles.kicker}>بزنس جديد</span>
        <h2 id="business-onboarding-title">المعلومات الأساسية فقط</h2>
        <p>
          اكتب اسم البزنس واختر عملته الأساسية. سنستخدم المنطقة الزمنية لتحديد الفترات المالية بشكل صحيح.
        </p>
      </div>

      {(serverError || localError) && (
        <div className={styles.error} role="alert">
          {localError ?? serverError}
        </div>
      )}

      <form action={createBusiness} className={styles.form} onSubmit={handleSubmit}>
        <input type="hidden" name="creation_request_id" value={creationRequestId} />
        <input type="hidden" name="base_currency" value={currency} />

        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="business-name">
            اسم البزنس
          </label>
          <p className={styles.help}>اكتب الاسم الذي تريد أن يظهر داخل ميزان.</p>
          <input
            id="business-name"
            name="name"
            className={styles.textInput}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            autoComplete="organization"
            placeholder="مثال: أكاديمية ميزان"
            disabled={isSubmitting}
          />
        </div>

        <fieldset className={styles.fieldGroup}>
          <legend className={styles.label}>العملة الأساسية</legend>
          <p className={styles.help}>كل أرقام هذا البزنس ستكون بهذه العملة.</p>
          <div className={styles.currencyGrid}>
            {CURRENCY_OPTIONS.map((option) => (
              <button
                key={option.code}
                type="button"
                className={currency === option.code ? styles.currencySelected : styles.currencyButton}
                aria-pressed={currency === option.code}
                onClick={() => setCurrency(option.code)}
                disabled={isSubmitting}
              >
                <strong className={styles.currencyCode}>{option.code}</strong>
                <span className={styles.currencyLabel}>{option.label}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className={styles.timezoneGroup}>
          <div className={styles.timezoneHeader}>
            <div>
              <span className={styles.secondaryLabel}>المنطقة الزمنية</span>
              <p className={styles.timezoneHelp}>نستخدمها فقط لتحديد بداية ونهاية الشهر بشكل صحيح.</p>
            </div>

            {timezone && !isTimezoneEditing && (
              <button
                className={styles.inlineButton}
                type="button"
                onClick={() => setIsTimezoneEditing(true)}
                disabled={isSubmitting}
              >
                تغيير
              </button>
            )}
          </div>

          <input type="hidden" name="timezone" value={timezone} />

          {isTimezoneEditing ? (
            <div className={styles.timezoneEditor}>
              <label className="sr-only" htmlFor="business-timezone">
                المنطقة الزمنية
              </label>
              <select
                id="business-timezone"
                className={styles.select}
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                disabled={isSubmitting}
              >
                {!timezone && <option value="">اختر المنطقة الزمنية</option>}
                {timezoneOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {timezone && (
                <button
                  className={styles.inlineButton}
                  type="button"
                  onClick={() => setIsTimezoneEditing(false)}
                  disabled={isSubmitting}
                >
                  تم
                </button>
              )}
            </div>
          ) : timezone ? (
            <strong className={styles.timezoneValue} dir="ltr">
              {timezoneLabel}
            </strong>
          ) : (
            <span className={styles.timezoneMissing}>اختر المنطقة الزمنية للمتابعة.</span>
          )}
        </div>

        <div className={styles.actions}>
          <button className={styles.primaryButton} type="submit" disabled={isSubmitting}>
            {isSubmitting ? "جارٍ الإنشاء…" : "إنشاء البزنس والمتابعة"}
          </button>
        </div>
      </form>
    </section>
  );
}
