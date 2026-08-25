import Link from "next/link";

export function DomainAdminNav({ hostname, aliases = 0 }: { hostname: string; aliases?: number }) {
  return (
    <nav aria-label="Domain administration">
      <strong>{hostname}</strong>
      <Link href="/admin/domain">Overview</Link>
      <Link href="/admin/users">Users</Link>
      <Link href="/admin/aliases">Aliases{aliases > 0 ? ` (${aliases})` : ""}</Link>
      <Link href="/admin/settings">Settings</Link>
    </nav>
  );
}
