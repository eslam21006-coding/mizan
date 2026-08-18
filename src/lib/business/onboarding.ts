export const SUPPORTED_CURRENCIES = ["USD", "AED", "SAR", "EGP", "KWD", "QAR", "JOD", "EUR"] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_OPTIONS: ReadonlyArray<{
  code: SupportedCurrency;
  label: string;
}> = [
  { code: "EGP", label: "جنيه مصري" },
  { code: "SAR", label: "ريال سعودي" },
  { code: "AED", label: "درهم إماراتي" },
  { code: "USD", label: "دولار أمريكي" },
  { code: "KWD", label: "دينار كويتي" },
  { code: "QAR", label: "ريال قطري" },
  { code: "JOD", label: "دينار أردني" },
  { code: "EUR", label: "يورو" },
];

export const TIMEZONE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "Africa/Cairo", label: "القاهرة — Africa/Cairo" },
  { value: "Asia/Riyadh", label: "الرياض — Asia/Riyadh" },
  { value: "Asia/Dubai", label: "دبي — Asia/Dubai" },
  { value: "Asia/Kuwait", label: "الكويت — Asia/Kuwait" },
  { value: "Asia/Qatar", label: "الدوحة — Asia/Qatar" },
  { value: "Asia/Amman", label: "عمّان — Asia/Amman" },
  { value: "Europe/Paris", label: "أوروبا الوسطى — Europe/Paris" },
  { value: "America/New_York", label: "نيويورك — America/New_York" },
  { value: "UTC", label: "UTC" },
];

export function normalizeBusinessName(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const length = [...normalized].length;

  return length >= 1 && length <= 120 ? normalized : null;
}

export function parseBaseCurrency(value: unknown): SupportedCurrency | null {
  const candidate = String(value ?? "").trim().toUpperCase();
  return SUPPORTED_CURRENCIES.includes(candidate as SupportedCurrency)
    ? (candidate as SupportedCurrency)
    : null;
}

export function normalizeTimeZone(value: unknown) {
  const timezone = String(value ?? "").trim();
  if (timezone.length < 1 || timezone.length > 64) {
    return null;
  }

  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format(new Date(0));
    return timezone;
  } catch {
    return null;
  }
}
