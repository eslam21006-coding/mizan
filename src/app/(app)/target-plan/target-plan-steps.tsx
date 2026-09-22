import Link from "next/link";
import {
  buildTargetPlannerStepHref,
  type TargetPlannerStep,
  type TargetPlannerStepHrefState,
} from "@/lib/target-planner-step";
import styles from "./target-plan-steps.module.css";

const STEPS: Array<{ id: TargetPlannerStep; label: string; description: string }> = [
  {
    id: "goal",
    label: "١. الهدف",
    description: "حدد نوع الهدف والقيمة المستهدفة.",
  },
  {
    id: "assumptions",
    label: "٢. الافتراضات",
    description: "راجع افتراضات آخر 3 أشهر المستخدمة في الحساب.",
  },
  {
    id: "plan",
    label: "٣. الخطة",
    description: "راجع المتطلبات المالية والتشغيلية الناتجة.",
  },
];

type TargetPlanStepsProps = {
  activeStep: TargetPlannerStep;
  state: TargetPlannerStepHrefState;
  basePath?: string;
};

/** Renders the URL-backed Target Planner workflow steps while preserving target context. */
export function TargetPlanSteps({
  activeStep,
  state,
  basePath,
}: TargetPlanStepsProps) {
  return (
    <nav className={styles.steps} aria-label="مراحل خطة الوصول للهدف">
      {STEPS.map((step) => {
        const active = step.id === activeStep;
        return (
          <Link
            key={step.id}
            href={buildTargetPlannerStepHref(state, step.id, basePath)}
            className={`${styles.step} ${active ? styles.active : ""}`}
            aria-current={active ? "step" : undefined}
            scroll={false}
          >
            <strong>{step.label}</strong>
            <span>{step.description}</span>
          </Link>
        );
      })}
    </nav>
  );
}
