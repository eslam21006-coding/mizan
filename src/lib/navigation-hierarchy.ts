export type NavigationDestination =
  | { route: "businesses" }
  | { route: "business-overview"; businessId: string }
  | {
      route: "business-customers";
      businessId: string;
      view?: "profitability";
      month?: string;
    }
  | { route: "business-customer-review"; businessId: string }
  | { route: "business-monthly"; businessId: string; month?: string };

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
      return `/?${searchParams.toString()}`;
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
      if (!destination.month) {
        return pathname;
      }

      const searchParams = new URLSearchParams({ month: destination.month });
      return `${pathname}?${searchParams.toString()}`;
    }
  }
}
