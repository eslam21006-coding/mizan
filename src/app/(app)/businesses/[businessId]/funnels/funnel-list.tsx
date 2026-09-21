import { FUNNEL_TYPE_OPTIONS } from "@/lib/business/funnels";
import { updateFunnel } from "./actions";
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

/** Renders a compact Funnel list while keeping the existing editor available on demand. */
export function FunnelList({ businessId, funnels, canManage }: FunnelListProps) {
  return (
    <div className={styles.funnelList}>
      {funnels.map((funnel) =>
        canManage ? (
          <details className={styles.funnelCard} key={funnel.id}>
            <summary className={styles.funnelSummary}>
              <div className={styles.funnelIdentity}>
                <strong>{funnel.name}</strong>
                <div className={styles.funnelBadges}>
                  <span className={funnel.is_active ? styles.activeBadge : styles.inactiveBadge}>
                    {funnel.is_active ? "نشطة" : "غير نشطة"}
                  </span>
                  <span className={styles.typeBadge}>{funnelTypeLabel(funnel.funnel_type)}</span>
                </div>
              </div>

              <span className={styles.editDisclosure}>
                <span>تعديل</span>
                <span className={styles.disclosureIcon} aria-hidden="true">
                  ⌄
                </span>
              </span>
            </summary>

            <form action={updateFunnel} className={styles.editForm}>
              <input type="hidden" name="business_id" value={businessId} />
              <input type="hidden" name="funnel_id" value={funnel.id} />

              <label>
                <span>الاسم</span>
                <input
                  type="text"
                  name="name"
                  maxLength={120}
                  required
                  defaultValue={funnel.name}
                  autoComplete="off"
                />
              </label>

              <label>
                <span>النوع</span>
                <select name="funnel_type" defaultValue={funnel.funnel_type}>
                  {FUNNEL_TYPE_OPTIONS.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.activeToggle}>
                <input type="checkbox" name="is_active" defaultChecked={funnel.is_active} />
                <span>الفانل نشطة وتظهر في الإدخالات الجديدة</span>
              </label>

              <button type="submit">حفظ التعديلات</button>
            </form>
          </details>
        ) : (
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

              <span className={styles.readOnlyBadge}>عرض فقط</span>
            </div>
          </article>
        ),
      )}
    </div>
  );
}
