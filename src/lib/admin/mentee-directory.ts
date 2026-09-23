import { parseResourceId } from "../business/revenue-streams.ts";

export type MenteeDirectoryRow = {
  mentee_user_id: string;
  mentee_email: string | null;
  mentee_created_at: string | null;
  business_id: string | null;
  business_name: string | null;
  base_currency: string | null;
  timezone: string | null;
};

export type MenteeBusiness = {
  id: string;
  name: string;
  baseCurrency: string;
  timezone: string;
};

export type MenteeRecord = {
  userId: string;
  email: string | null;
  createdAt: string | null;
  businesses: MenteeBusiness[];
};

/** Groups the admin directory RPC rows into an explicit Mentee → Businesses hierarchy. */
export function groupMenteeDirectoryRows(rows: readonly MenteeDirectoryRow[]) {
  const mentees = new Map<string, MenteeRecord>();

  for (const row of rows) {
    const userId = parseResourceId(row.mentee_user_id);
    if (!userId) continue;

    const existing = mentees.get(userId) ?? {
      userId,
      email: row.mentee_email,
      createdAt: row.mentee_created_at,
      businesses: [],
    };

    const businessId = row.business_id ? parseResourceId(row.business_id) : null;
    if (businessId && row.business_name && row.base_currency && row.timezone) {
      if (!existing.businesses.some((business) => business.id === businessId)) {
        existing.businesses.push({
          id: businessId,
          name: row.business_name,
          baseCurrency: row.base_currency,
          timezone: row.timezone,
        });
      }
    }

    mentees.set(userId, existing);
  }

  return [...mentees.values()];
}

/** Finds one validated Mentee inside the already-authorized admin directory result. */
export function findMenteeRecord(rows: readonly MenteeDirectoryRow[], rawUserId: unknown) {
  const userId = parseResourceId(rawUserId);
  if (!userId) return null;
  return groupMenteeDirectoryRows(rows).find((mentee) => mentee.userId === userId) ?? null;
}
