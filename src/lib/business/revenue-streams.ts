export const REVENUE_STREAM_TYPES = ["front_end", "backend"] as const;

export type RevenueStreamType = (typeof REVENUE_STREAM_TYPES)[number];

export const REVENUE_STREAM_TYPE_OPTIONS: ReadonlyArray<{
  value: RevenueStreamType;
  label: string;
}> = [
  { value: "front_end", label: "Front-End / أمامي" },
  { value: "backend", label: "Backend / خلفي" },
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeRevenueStreamName(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const length = [...normalized].length;

  return length >= 1 && length <= 120 ? normalized : null;
}

export function parseRevenueStreamType(value: unknown): RevenueStreamType | null {
  const candidate = String(value ?? "").trim();
  return REVENUE_STREAM_TYPES.includes(candidate as RevenueStreamType)
    ? (candidate as RevenueStreamType)
    : null;
}

export function parseResourceId(value: unknown) {
  const candidate = String(value ?? "").trim();
  return UUID_PATTERN.test(candidate) ? candidate.toLowerCase() : null;
}

export function parseActiveState(value: unknown) {
  return value === "on" || value === "true" || value === true;
}
