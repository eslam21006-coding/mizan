export type NavigationDestination =
  | { route: "businesses" }
  | { route: "business-overview"; businessId: string; month?: string }
  | { route: "business-workspace"; businessId: string }
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
      origin?: "customer-overview" | "customer-profitability";
      returnMonth?: string;
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
      if (destination.origin === "customer-profitability" && destination.returnMonth) {
        searchParams.set("return_month", destination.returnMonth);
      }
      const query = searchParams.toString();
      return query ? `${pathname}?${query}` : pathname;
    }
  }
}
