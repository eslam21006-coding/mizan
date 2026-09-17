export type NavigationDestination =
  | { route: "businesses" }
  | { route: "business-overview"; businessId: string }
  | { route: "business-customers"; businessId: string }
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

function businessPath(businessId: string) {
  return `/businesses/${encodeURIComponent(businessId)}`;
}

export function resolveNavigationDestination(destination: NavigationDestination) {
  switch (destination.route) {
    case "businesses":
      return "/businesses";
    case "business-overview": {
      const searchParams = new URLSearchParams({ business: destination.businessId });
      return `/?${searchParams.toString()}`;
    }
    case "business-customers":
      return `${businessPath(destination.businessId)}/customers`;
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
