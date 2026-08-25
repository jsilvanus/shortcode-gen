export function isLinkExpired(expiresAt: Date | null, now = new Date()): boolean {
  return expiresAt !== null && expiresAt.getTime() <= now.getTime();
}

export function isLinkActive(active: boolean, expiresAt: Date | null, now = new Date()): boolean {
  return active && !isLinkExpired(expiresAt, now);
}
