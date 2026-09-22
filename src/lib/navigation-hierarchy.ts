import type { TargetGoalType } from "./business/target-engine";
import type { TargetPlannerStep } from "./target-planner-step";
export type NavigationDestination =
  | { route: "businesses" }
  | { route: "business-overview"; businessId: string; month?: string }
  | { route: "business-workspace"; businessId: string }
  | { route: "business-funnels"; businessId: string }
  | { route: "insights"; businessId: string; month: string; insightId: string }
  | {
      route: "target-planner";
      businessId: string;
      step: TargetPlannerStep;
      goal: TargetGoalType;
      value?: string;
    }
  | {
      route: "business-customers";
      businessId: string;
      view?: "profitability";
      month?: string;
    }
  | { route: "business-customer-review"; businessId: string }
  | {
      route: "business-monthly";
      businessId: string;
      month?: string;
      origin?: "customer-overview" | "customer-profitability" | "insights" | "target-planner";
      returnMonth?: string;
      insightRuleId?: string;
      insightSubjectId?: string;
      plannerStep?: TargetPlannerStep;
      plannerGoal?: TargetGoalType;
      plannerValue?: string;
    };

export type BreadcrumbItem =
  | {
      label: string;
      destination: NavigationDestination;
      current?: never;
    }
  | {
      label: string;
      current: true;
      destination?: never;
    };

export type BackNavigation = {
  label: string;
  destination: NavigationDestination;
};

/** Builds an encoded path prefix for routes nested under a business. */
function businessPath(businessId: string) {
  return `/businesses/${encodeURIComponent(businessId)}`;
}

/** Resolves a known navigation destination to its canonical application URL. */
export function resolveNavigationDestination(destination: NavigationDestination) {
  switch (destination.route) {
    case "businesses":
      return "/businesses";
    case "business-overview": {
      const searchParams = new URLSearchParams({ business: destination.businessId });
      if (destination.month) searchParams.set("month", destination.month);
      return `/?${searchParams.toString()}`;
    }
    case "business-workspace":
      return businessPath(destination.businessId);
    case "business-funnels":
      return `${businessPath(destination.businessId)}/funnels`;
    case "target-planner": {
      const searchParams = new URLSearchParams({
        business: destination.businessId,
        goal: destination.goal,
        step: destination.step,
      });
      if (destination.value !== undefined) searchParams.set("value", destination.value);
      return `/target-plan?${searchParams.toString()}`;
    }
    case "insights": {
      const searchParams = new URLSearchParams({
        business: destination.businessId,
        month: destination.month,
      });
      return `/insights?${searchParams.toString()}#insight-${encodeURIComponent(destination.insightId)}`;
    }
    case "business-customers": {
      const pathname = `${businessPath(destination.businessId)}/customers`;
      const searchParams = new URLSearchParams();
      if (destination.view) searchParams.set("view", destination.view);
      if (destination.month) searchParams.set("month", destination.month);
      const query = searchParams.toString();
      return query ? `${pathname}?${query}` : pathname;
    }
    case "business-customer-review":
      return `${businessPath(destination.businessId)}/customers/review`;
    case "business-monthly": {
      const pathname = `${businessPath(destination.businessId)}/monthly`;
      const searchParams = new URLSearchParams();
      if (destination.month) searchParams.set("month", destination.month);
      if (destination.origin) searchParams.set("origin", destination.origin);
      if (
        (destination.origin === "customer-profitability" || destination.origin === "insights") &&
        destination.returnMonth
      ) {
        searchParams.set("return_month", destination.returnMonth);
      }
      if (destination.origin === "insights" && destination.insightRuleId) {
        searchParams.set("insight_rule", destination.insightRuleId);
      }
      if (destination.origin === "insights" && destination.insightSubjectId) {
        searchParams.set("insight_subject", destination.insightSubjectId);
      }
      if (destination.origin === "target-planner" && destination.plannerStep && destination.plannerGoal) {
        searchParams.set("planner_step", destination.plannerStep);
        searchParams.set("planner_goal", destination.plannerGoal);
        if (destination.plannerValue !== undefined) {
          searchParams.set("planner_value", destination.plannerValue);
        }
      }
      const query = searchParams.toString();
      return query ? `${pathname}?${query}` : pathname;
    }
  }
}
