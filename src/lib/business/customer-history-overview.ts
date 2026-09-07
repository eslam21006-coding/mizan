export type CustomerHistoryOverviewSummary = {
  payingCustomerCountText: string;
  repeatCustomerCountText: string;
  netCashCollectedText: string;
  revenuePerPayingCustomerText: string | null;
};

const INTEGER_TEXT = /^(?:0|[1-9]\d*)$/;
const DECIMAL_TEXT = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

/** Parses exact database text fields without converting monetary values or counts through JavaScript Number. */
export function parseCustomerHistoryOverviewSummary(
  value: unknown,
): CustomerHistoryOverviewSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const payingCustomerCountText = record.paying_customer_count_text;
  const repeatCustomerCountText = record.repeat_customer_count_text;
  const netCashCollectedText = record.net_cash_collected_text;
  const revenuePerPayingCustomerText = record.revenue_per_paying_customer_text;

  if (
    typeof payingCustomerCountText !== "string" ||
    !INTEGER_TEXT.test(payingCustomerCountText) ||
    typeof repeatCustomerCountText !== "string" ||
    !INTEGER_TEXT.test(repeatCustomerCountText) ||
    typeof netCashCollectedText !== "string" ||
    !DECIMAL_TEXT.test(netCashCollectedText) ||
    (revenuePerPayingCustomerText !== null &&
      (typeof revenuePerPayingCustomerText !== "string" ||
        !DECIMAL_TEXT.test(revenuePerPayingCustomerText)))
  ) {
    return null;
  }

  const payingCustomerCount = BigInt(payingCustomerCountText);
  const repeatCustomerCount = BigInt(repeatCustomerCountText);
  if (repeatCustomerCount > payingCustomerCount) return null;
  if ((payingCustomerCount === 0n) !== (revenuePerPayingCustomerText === null)) return null;

  return {
    payingCustomerCountText,
    repeatCustomerCountText,
    netCashCollectedText,
    revenuePerPayingCustomerText,
  };
}
