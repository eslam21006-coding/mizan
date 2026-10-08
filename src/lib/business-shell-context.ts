export type ShellBusiness = {
  id: string;
  name: string;
  baseCurrency: string;
  timezone: string;
};

type BusinessContextInput = {
  pathname: string;
  search?: string;
  businesses: readonly ShellBusiness[];
};

type BusinessSwitchInput = {
  pathname: string;
  search?: string;
  targetBusinessId: string;
};

const MANAGE_BUSINESSES_HREF = "/businesses";

/** Safely decodes a business id from /businesses/:businessId routes. */
export function businessIdFromPathname(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "businesses" || !parts[1]) {
    return null;
  }

  try {
    return decodeURIComponent(parts[1]);
  } catch {
    return null;
  }
}

/**
 * Resolves the shell's current business from a scoped route first, then the
 * business query parameter, and finally the first accessible business.
 */
export function resolveShellBusinessId({
  pathname,
  search = "",
  businesses,
}: BusinessContextInput) {
  if (businesses.length === 0) {
    return null;
  }

  const accessibleIds = new Set(businesses.map((business) => business.id));
  const scopedBusinessId = businessIdFromPathname(pathname);
  if (scopedBusinessId && accessibleIds.has(scopedBusinessId)) {
    return scopedBusinessId;
  }

  const queryBusinessId = new URLSearchParams(search).get("business");
  if (queryBusinessId && accessibleIds.has(queryBusinessId)) {
    return queryBusinessId;
  }

  return businesses[0]?.id ?? null;
}

function businessPath(businessId: string) {
  return `/businesses/${encodeURIComponent(businessId)}`;
}

function preservedSearch(
  search: string,
  businessId: string | null,
  allowedKeys: readonly string[],
) {
  const source = new URLSearchParams(search);
  const result = new URLSearchParams();

  if (businessId) {
    result.set("business", businessId);
  }

  for (const key of allowedKeys) {
    for (const value of source.getAll(key)) {
      result.append(key, value);
    }
  }

  const query = result.toString();
  return query ? `?${query}` : "";
}

/**
 * Resolves a business switch without carrying business-specific workflow state
 * into another business. Safe period/planner context is preserved where useful.
 */
export function resolveBusinessSwitchHref({
  pathname,
  search = "",
  targetBusinessId,
}: BusinessSwitchInput) {
  const targetPath = businessPath(targetBusinessId);
  const parts = pathname.split("/").filter(Boolean);

  if (pathname === "/") {
    return `/${preservedSearch(search, targetBusinessId, ["month"])}`;
  }

  if (pathname === "/analytics") {
    return `/analytics${preservedSearch(search, targetBusinessId, [
      "month",
      "period",
      "view",
      "start",
      "end",
    ])}`;
  }

  if (pathname === "/insights") {
    return `/insights${preservedSearch(search, targetBusinessId, ["month"])}`;
  }

  if (pathname === "/target-plan") {
    return `/target-plan${preservedSearch(search, targetBusinessId, [
      "goal",
      "value",
      "step",
    ])}`;
  }

  if (pathname === "/simulator") {
    return `/simulator${preservedSearch(search, targetBusinessId, ["month"])}`;
  }

  if (pathname === "/monthly") {
    return `${targetPath}/monthly${preservedSearch(search, null, ["month"])}`;
  }

  if (pathname === "/customers") {
    return `${targetPath}/customers`;
  }

  if (pathname === "/funnels") {
    return `${targetPath}/funnels`;
  }

  if (pathname === "/settings") {
    return `${targetPath}/settings`;
  }

  if (parts[0] === "businesses" && parts.length >= 3) {
    const segment = parts[2];

    if (segment === "monthly") {
      return `${targetPath}/monthly${preservedSearch(search, null, ["month"])}`;
    }

    if (segment === "customers") {
      const isCustomerLanding = parts.length === 3;
      return isCustomerLanding
        ? `${targetPath}/customers${preservedSearch(search, null, ["view", "month"])}`
        : `${targetPath}/customers`;
    }

    if (segment === "funnels") {
      const monthly = parts[3] === "monthly" ? "/monthly" : "";
      return `${targetPath}/funnels${monthly}${preservedSearch(search, null, ["month"])}`;
    }

    if (segment === "liquidation") {
      return `${targetPath}/liquidation${preservedSearch(search, null, ["month"])}`;
    }

    if (segment === "settings") {
      return `${targetPath}/settings`;
    }
  }

  return `/?business=${encodeURIComponent(targetBusinessId)}`;
}

/** Makes the B13 navigation destination business-aware when a business is selected. */
export function resolveBusinessAwareNavigationHref(href: string, businessId: string | null) {
  if (!businessId) {
    return href;
  }

  return resolveBusinessSwitchHref({
    pathname: href,
    targetBusinessId: businessId,
  });
}

/** Returns the secondary destination used to manage business records. */
export function manageBusinessesHref() {
  return MANAGE_BUSINESSES_HREF;
}
