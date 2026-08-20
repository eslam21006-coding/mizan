"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthCard } from "@/components/auth-card";
import styles from "@/components/auth-card.module.css";
import { safeLocalPath } from "@/lib/auth/redirect";
import { parseAuthSessionFragment } from "@/lib/auth/session-fragment";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type CallbackState = "working" | "error";

export default function AuthCallbackPage() {
  const [state, setState] = useState<CallbackState>("working");

  useEffect(() => {
    let cancelled = false;

    async function establishSession() {
      const session = parseAuthSessionFragment(window.location.hash);
      if (!session) {
        if (!cancelled) setState("error");
        return;
      }

      const next = safeLocalPath(
        new URLSearchParams(window.location.search).get("next"),
        "/set-password",
      );
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.setSession({
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
      });

      if (cancelled) return;
      if (error) {
        setState("error");
        return;
      }

      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      window.location.replace(next);
    }

    void establishSession();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthCard
      eyebrow="تفعيل الحساب"
      title={state === "working" ? "جاري تجهيز حسابك" : "تعذر تفعيل الرابط"}
      description={
        state === "working"
          ? "يتم الآن إنشاء جلسة آمنة قبل اختيار كلمة المرور."
          : "رابط الدعوة أو استعادة كلمة المرور غير صالح أو انتهت صلاحيته."
      }
    >
      {state === "working" ? (
        <div className={styles.notice} role="status" aria-live="polite">
          لحظات قليلة وسيتم نقلك تلقائيًا إلى صفحة اختيار كلمة المرور.
        </div>
      ) : (
        <>
          <div className={styles.error} role="alert">
            لم نتمكن من إنشاء جلسة آمنة من هذا الرابط. اطلب رابطًا جديدًا ثم حاول مرة أخرى.
          </div>
          <Link className={styles.link} href="/login">
            العودة إلى تسجيل الدخول
          </Link>
        </>
      )}
    </AuthCard>
  );
}
