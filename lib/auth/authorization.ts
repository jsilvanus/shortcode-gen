export type UserRole = "USER" | "ADMIN";

export function canViewLink(
  role: UserRole,
  ownerId: string,
  currentUserId: string,
  isPrivate: boolean,
): boolean {
  return role === "ADMIN" || ownerId === currentUserId || !isPrivate;
}

/**
 * Non-private links are collaboratively editable by authenticated users.
 * Private links are editable only by their owner or an administrator.
 */
export function canEditLink(
  role: UserRole,
  ownerId: string,
  currentUserId: string,
  isPrivate: boolean,
): boolean {
  return role === "ADMIN" || ownerId === currentUserId || !isPrivate;
}

export function canManageSiteSettings(role: UserRole): boolean {
  return role === "ADMIN";
}
