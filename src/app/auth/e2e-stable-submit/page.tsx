import { notFound } from "next/navigation";
import { StableSubmitButton } from "@/components/stable-submit-button";

export const dynamic = "force-dynamic";

/** CI-only delayed action used to prove one in-flight submit blocks repeat activation. */
async function slowSubmit() {
  "use server";
  await new Promise((resolve) => setTimeout(resolve, 800));
}

/** Renders a minimal production submit control fixture without touching business persistence. */
export default function StableSubmitFixturePage() {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  return (
    <main>
      <h1>اختبار الحفظ المعلّق</h1>
      <form action={slowSubmit}>
        <StableSubmitButton pendingLabel="جارٍ الحفظ…">
          حفظ
        </StableSubmitButton>
      </form>
    </main>
  );
}
