"use client";

import { usePathname } from "next/navigation";

export function DomainContextNav({
  hostname,
  aliases,
  role,
}: {
  hostname: string;
  aliases: string[];
  role: "USER" | "ADMIN" | null;
}) {
  const pathname = usePathname();
  const links = [
    ["Links", "/links"],
    ...(role === "ADMIN" ? [["Users", "/admin/users"], ["Aliases", "/admin/aliases"], ["Settings", "/admin/settings"], ["Reports", "/admin/complaints"]] : []),
  ] as const;

  return (
    <header className="domain-context-nav">
      <div>
        <strong>{hostname}</strong>
        {aliases.length > 0 && <small> · {aliases.length} alias{aliases.length === 1 ? "" : "es"}</small>}
      </div>
      <nav aria-label="Domain administration">
        {links.map(([label, href]) => (
          <a key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</a>
        ))}
      </nav>
    </header>
  );
}
