import { FUNNEL_TYPE_OPTIONS } from "@/lib/business/funnels";
import { FunnelEditDrawerLauncher } from "./funnel-edit-drawer";
import styles from "./funnels.module.css";

export type FunnelListItem = {
  id: string;
  name: string;
  funnel_type: string;
  is_active: boolean;
};

type FunnelListProps = {
  businessId: string;
  funnels: readonly FunnelListItem[];
  canManage: boolean;
};

/** Returns the founder-facing label for a persisted Funnel type without changing its stored value. */
function funnelTypeLabel(value: string) {
  return FUNNEL_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

/** Renders a compact Funnel list with edit drawers for authorized managers and stable read-only cards. */
export function FunnelList({ businessId, funnels, canManage }: FunnelListProps) {
  return (
    <div className={styles.funnelList}>
      {funnels.map((funnel) => (
        <article className={styles.funnelCard} key={funnel.id}>
          <div className={styles.funnelSummaryStatic}>
            <div className={styles.funnelIdentity}>
              <strong>{funnel.name}</strong>
              <div className={styles.funnelBadges}>
                <span className={funnel.is_active ? styles.activeBadge : styles.inactiveBadge}>
                  {funnel.is_active ? "نشطة" : "غير نشطة"}
                </span>
                <span className={styles.typeBadge}>{funnelTypeLabel(funnel.funnel_type)}</span>
              </div>
            </div>

            {canManage ? (
              <FunnelEditDrawerLauncher
                businessId={businessId}
                typeOptions={FUNNEL_TYPE_OPTIONS}
                funnel={funnel}
              />
            ) : (
              <span className={styles.readOnlyBadge}>عرض فقط</span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
