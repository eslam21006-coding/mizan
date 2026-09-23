import type { MizanRole } from "./auth/role.ts";

/** Identifies when an Admin is viewing a business owned by another user. */
export function resolveAdminViewingMenteeUserId(
  role: MizanRole,
  viewerUserId: string,
  ownerUserId: string,
) {
  return role === "admin" && ownerUserId !== viewerUserId ? ownerUserId : null;
}
