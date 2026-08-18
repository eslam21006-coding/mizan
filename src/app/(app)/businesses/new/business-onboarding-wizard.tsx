"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  CURRENCY_OPTIONS,
  TIMEZONE_OPTIONS,
  type SupportedCurrency,
} from "@/lib/business/onboarding";
import { createBusiness } from "./actions";
import styles from "./onboarding.module.css";

type BusinessOnboardingWizardProps = {
  creationRequestId: string;
  serverError?: string | null;
};

const steps = ["اسم البزنس", "العملة", "المنطقة الزمنية", "مراجعة"] as const;

export function BusinessOnboardingWizard({
  creationRequestId,
  serverError,
}: BusinessOnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<SupportedCurrency | "">("");
  const [timezone, setTimezone] = useState("Africa/Cairo");
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected) {
      setTimezone(detected);
    }
  }, []);

  const timezoneOptions = useMemo(() => {
    if (TIMEZONE_OPTIONS.some((option) => option.value === timezone)) {
      return TIMEZONE_OPTIONS;
    }

    return [{ value: timezone, label: `المنطقة الحالية — ${timezone}` }, ...TIMEZONE_OPTIONS];
  }, [timezone]);

  function goForward() {
    setLocalError(null);

    if (step === 0 && name.trim().length === 0) {
      setLocalError("اكتب اسم البزنس أولًا.");
      return;
    }

    if (step === 1 && !currency) {
      setLocalError("اختر العملة الأساسية للبزنس.");
      return;
    }

    if (step < steps.length - 1) {
      setStep((current) => current + 1);
    }
  }

  function goBack() {
    setLocalError(null);
    setStep((current) => Math.max(0, current - 1));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (step < steps.length - 1) {
      event.preventDefault();
      goForward();
      return;
    }

    setIsSubmitting(true);
  }

  const currencyLabel = CURRENCY_OPTIONS.find((option) => option.code === currency)?.label;

  return (
    <section className={styles.wizard} aria-labelledby="business-onboarding-title">
      <div className={styles.progressHeader}>
        <div>
          <span className={styles.kicker}>إعداد البزنس</span>
          <h2 id="business-onboarding-title">أربع خطوات قصيرة فقط</h2>
        </div>
        <strong className={styles.stepCount} aria-live="polite">
          {step + 1} / {steps.length}
        </strong>
      </div>

      <ol className={styles.stepper} aria-label="خطوات إعداد البزنس">
        {steps.map((label, index) => (
          <li
            key={label}
            className={index === step ? styles.activeStep : index < step ? styles.doneStep : undefined}
            aria-current={index === step ? "step" : undefined}
          >
            <span className={styles.stepNumber}>{index + 1}</span>
            <small>{label}</small>
          </li>
        ))}
      </ol>

      {(serverError || localError) && (
        <div className={styles.error} role="alert">
          {localError ?? serverError}
        </div>
      )}

      <form action={createBusiness} className={styles.form} onSubmit={handleSubmit}>
        <input type="hidden" name="creation_request_id" value={creationRequestId} />
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="base_currency" value={currency} />
        <input type="hidden" name="timezone" value={timezone} />

        {step === 0 && (
          <div className={styles.stepPanel}>
            <label className={styles.label} htmlFor="business-name">
              اسم البزنس
            </label>
            <p className={styles.help}>اكتب الاسم الذي تحب أن يظهر لك داخل ميزان.</p>
            <input
              id="business-name"
              className={styles.textInput}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              autoComplete="organization"
              placeholder="مثال: أكاديمية رسالتك"
            />
          </div>
        )}

        {step === 1 && (
          <fieldset className={styles.stepPanel}>
            <legend className={styles.label}>العملة الأساسية</legend>
            <p className={styles.help}>
              كل أرقام البزنس في V1 ستكون بهذه العملة. ميزان لن يعمل تحويل عملات تلقائيًا.
            </p>
            <div className={styles.currencyGrid}>
              {CURRENCY_OPTIONS.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  className={currency === option.code ? styles.currencySelected : styles.currencyButton}
                  aria-pressed={currency === option.code}
                  onClick={() => setCurrency(option.code)}
                >
                  <strong className={styles.currencyCode}>{option.code}</strong>
                  <span className={styles.currencyLabel}>{option.label}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {step === 2 && (
          <div className={styles.stepPanel}>
            <label className={styles.label} htmlFor="business-timezone">
              المنطقة الزمنية
            </label>
            <p className={styles.help}>
              نستخدمها لتحديد بداية ونهاية الشهر بشكل صحيح عند إضافة البيانات لاحقًا.
            </p>
            <select
              id="business-timezone"
              className={styles.select}
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            >
              {timezoneOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {step === 3 && (
          <div className={styles.stepPanel}>
            <span className={styles.label}>راجع البيانات</span>
            <p className={styles.help}>هذه هي الإعدادات الأساسية فقط. باقي إعداد البزنس يأتي في المهام التالية.</p>
            <dl className={styles.reviewList}>
              <div>
                <dt>اسم البزنس</dt>
                <dd>{name.trim()}</dd>
              </div>
              <div>
                <dt>العملة</dt>
                <dd>
                  {currency} — {currencyLabel}
                </dd>
              </div>
              <div>
                <dt>المنطقة الزمنية</dt>
                <dd dir="ltr">{timezone}</dd>
              </div>
            </dl>
          </div>
        )}

        <div className={styles.actions}>
          {step > 0 && (
            <button className={styles.secondaryButton} type="button" onClick={goBack} disabled={isSubmitting}>
              السابق
            </button>
          )}
          {step < steps.length - 1 ? (
            <button className={styles.primaryButton} type="button" onClick={goForward}>
              التالي
            </button>
          ) : (
            <button className={styles.primaryButton} type="submit" disabled={isSubmitting}>
              {isSubmitting ? "جارٍ الإنشاء…" : "إنشاء البزنس"}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
