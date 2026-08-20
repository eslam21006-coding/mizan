export const FUNNEL_TYPES = [
  "webinar",
  "lead_gen",
  "low_ticket",
  "organic",
  "referral",
  "event",
] as const;

export type FunnelType = (typeof FUNNEL_TYPES)[number];

export const FUNNEL_TYPE_OPTIONS: ReadonlyArray<{
  value: FunnelType;
  label: string;
}> = [
  { value: "webinar", label: "Webinar / ويبينار" },
  { value: "lead_gen", label: "Lead Gen / توليد عملاء محتملين" },
  { value: "low_ticket", label: "Low Ticket / عرض منخفض السعر" },
  { value: "organic", label: "Organic / عضوي" },
  { value: "referral", label: "Referral / إحالات" },
  { value: "event", label: "Event / فعالية" },
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeFunnelName(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const length = [...normalized].length;

  return length >= 1 && length <= 120 ? normalized : null;
}

export function parseFunnelType(value: unknown): FunnelType | null {
  const candidate = String(value ?? "").trim();
  return FUNNEL_TYPES.includes(candidate as FunnelType) ? (candidate as FunnelType) : null;
}

export function parseFunnelResourceId(value: unknown) {
  const candidate = String(value ?? "").trim();
  return UUID_PATTERN.test(candidate) ? candidate.toLowerCase() : null;
}

export function parseFunnelActiveState(value: unknown) {
  return value === "on" || value === "true" || value === true;
}
