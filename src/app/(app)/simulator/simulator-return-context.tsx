import Link from "next/link";
import {
  buildTargetPlannerReturnHref,
  type SimulatorTargetPlannerReturnContext,
} from "@/lib/simulator-return-context";
import styles from "./simulator.module.css";

type SimulatorReturnContextProps = {
  context: SimulatorTargetPlannerReturnContext | null;
};

/** Renders the explicit Target Planner → Simulator workflow context and deterministic return action. */
export function SimulatorReturnContextBanner({ context }: SimulatorReturnContextProps) {
  if (!context) return null;

  return (
    <section className={styles.returnContextBanner} aria-label="سياق العودة إلى خطة الهدف">
      <div>
        <span>قادِم من خطة الوصول للهدف</span>
        <strong>أنت هنا لاختبار القرارات في المحاكي.</strong>
        <p>تم حفظ مكان الرجوع فقط؛ قيم خطة الهدف لا تُطبَّق على السيناريو تلقائيًا.</p>
      </div>
      <Link href={buildTargetPlannerReturnHref(context)}>
        العودة إلى نفس خطوة خطة الهدف
      </Link>
    </section>
  );
}

/** Carries validated Target Planner return metadata through Simulator GET and mutation forms. */
export function SimulatorReturnContextFields({ context }: SimulatorReturnContextProps) {
  if (!context) return null;

  return (
    <>
      <input type="hidden" name="origin" value="target-planner" />
      <input type="hidden" name="planner_business" value={context.plannerBusinessId} />
      <input type="hidden" name="planner_step" value={context.step} />
      <input type="hidden" name="planner_goal" value={context.goal} />
      {context.value !== undefined && (
        <input type="hidden" name="planner_value" value={context.value} />
      )}
    </>
  );
}
