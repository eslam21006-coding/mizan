import {
  findMenteeRecord,
  type MenteeDirectoryRow,
  type MenteeRecord,
} from "./admin/mentee-directory.ts";
import type { MizanRole } from "./auth/role.ts";

/** Returns a verified Mentee owner only when an Admin is viewing another user's business. */
export function resolveAdminViewingMentee(
  role: MizanRole,
  viewerUserId: string,
  ownerUserId: string,
  directoryRows: readonly MenteeDirectoryRow[],
): MenteeRecord | null {
  if (role !== "admin" || ownerUserId === viewerUserId) return null;
  return findMenteeRecord(directoryRows, ownerUserId);
}
