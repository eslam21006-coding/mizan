export type MizanRole = "admin" | "mentee";

export function getRoleFromAppMetadata(metadata: unknown): MizanRole | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const role = (metadata as Record<string, unknown>).role;
  return role === "admin" || role === "mentee" ? role : null;
}

export function getRoleFromClaims(claims: unknown): MizanRole | null {
  if (!claims || typeof claims !== "object") {
    return null;
  }

  return getRoleFromAppMetadata((claims as Record<string, unknown>).app_metadata);
}
