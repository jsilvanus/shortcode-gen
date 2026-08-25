export type UserRole = "USER" | "ADMIN";

export function canViewLink(
  role: UserRole,
  ownerId: string,
  currentUserId: string,
  isPrivate: boolean,
): boolean {
  return role === "ADMIN" || ownerId === currentUserId || !isPrivate;
}

export function canEditLink(
  role: UserRole,
  ownerId: string,
  currentUserId: string,
): boolean {
  return role === "ADMIN" || ownerId === currentUserId;
}

export function canManageSiteSettings(role: UserRole): boolean {
  return role === "ADMIN";
}
