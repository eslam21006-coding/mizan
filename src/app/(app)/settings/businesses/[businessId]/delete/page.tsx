import { notFound, redirect } from "next/navigation";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { resolveNavigationDestination } from "@/lib/navigation-hierarchy";

type LegacyDeleteBusinessPageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ status?: string }>;
};

const ALLOWED_DELETE_STATUSES = new Set(["confirmation-required", "failed"]);

/** Preserves old delete bookmarks while routing the workflow into Business Settings. */
export default async function LegacyDeleteBusinessPage({
  params,
  searchParams,
}: LegacyDeleteBusinessPageProps) {
  const [{ businessId: rawBusinessId }, query] = await Promise.all([params, searchParams]);
  const businessId = parseResourceId(rawBusinessId);
  if (!businessId) notFound();

  const canonical = resolveNavigationDestination({ route: "business-delete", businessId });
  if (query.status && ALLOWED_DELETE_STATUSES.has(query.status)) {
    redirect(`${canonical}?status=${encodeURIComponent(query.status)}`);
  }

  redirect(canonical);
}
