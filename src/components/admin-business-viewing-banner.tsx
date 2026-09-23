import Link from "next/link";
import { resolveNavigationDestination } from "@/lib/navigation-hierarchy";
import styles from "./admin-business-viewing-banner.module.css";

type AdminBusinessViewingBannerProps = {
  menteeUserId: string;
};

/** Warns an Admin that the active business belongs to a verified Mentee and provides a deterministic return path. */
export function AdminBusinessViewingBanner({
  menteeUserId,
}: AdminBusinessViewingBannerProps) {
  return (
    <aside className={styles.banner} aria-label="وضع عرض بزنس متدرب">
      <div>
        <span>وضع المدير</span>
        <strong>أنت تعرض بزنس تابعًا لمتدرب.</strong>
        <p>أي تعديل تنفذه هنا سيؤثر على بيانات هذا البزنس، وليس على حسابك كمدير.</p>
      </div>
      <Link
        href={resolveNavigationDestination({
          route: "admin-mentee",
          menteeUserId,
        })}
      >
        العودة إلى المتدرب
      </Link>
    </aside>
  );
}
