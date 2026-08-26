import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentDomainContext } from "@/lib/domain-context";
import { listApiKeys } from "@/lib/auth/api-keys";
import { listDomainMembers } from "@/lib/domain";
import { DashboardAnalytics } from "@/components/dashboard/dashboard-analytics";
import { CollectionManager } from "@/components/dashboard/collection-manager";
import { LinkManager } from "@/components/dashboard/link-manager";
import { ApiKeyManager } from "@/components/dashboard/api-key-manager";
import { AuditLogViewer } from "@/components/dashboard/audit-log-viewer";

export default async function UserDashboardPage() {
  const context = await getCurrentDomainContext();
  if (!context.user) redirect("/admin/login");
  if (!context.membership) redirect("/admin/login");

  const user = context.user;
  const isDomainAdmin = context.membership.role === "ADMIN";
  const [links, collections] = await Promise.all([
    db.shortLink.findMany({
      where: {
        domainId: context.domain.id,
        OR: [{ ownerId: user.id }, { isPrivate: false }],
      },
      select: {
        id: true,
        code: true,
        title: true,
        targetUrl: true,
        description: true,
        isPrivate: true,
        active: true,
        expiresAt: true,
        ownerId: true,
        screenshotDisabled: true,
        redirectDelaySeconds: true,
        collections: { select: { collectionId: true } },
      },
      orderBy: { code: "asc" },
    }),
    db.collection.findMany({
      where: {
        domainId: context.domain.id,
        OR: [{ ownerId: user.id }, { isPrivate: false }],
      },
      select: { id: true, name: true, description: true, isPrivate: true, ownerId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const manageableCollections = collections.filter(c => c.ownerId === user.id || isDomainAdmin);
  const linkOptions = links.map(l => ({
    ...l,
    expiresAt: l.expiresAt?.toISOString() ?? null,
    collectionIds: l.collections.map(c => c.collectionId),
  }));
  const apiKeys = (await listApiKeys(context.domain.id, user.id)).map(k => ({
    ...k,
    createdAt: k.createdAt.toISOString(),
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    expiresAt: k.expiresAt?.toISOString() ?? null,
    revokedAt: k.revokedAt?.toISOString() ?? null,
  }));
  const domainMembers = isDomainAdmin ? (await listDomainMembers(context.domain.id)).map(m => ({ id: m.user.id, username: m.user.username })) : [];

  return (
    <main>
      <h1>My links</h1>
      <p>Signed in as {user.username}.</p>
      <p>Domain: {context.domain.hostname}</p>
      <CollectionManager initial={manageableCollections} />
      <section style={{ marginTop: 32 }} aria-labelledby="link-management-title">
        <h2 id="link-management-title">Manage links</h2>
        <LinkManager
          initial={linkOptions.map(l => ({
            ...l,
            canEdit: isDomainAdmin || l.ownerId === user.id || !l.isPrivate,
          }))}
          collections={manageableCollections}
        />
      </section>
      <section style={{ marginTop: 32 }} aria-labelledby="analytics-title">
        <h2 id="analytics-title">Statistics</h2>
        <DashboardAnalytics links={linkOptions} collections={collections} />
      </section>
      <section style={{ marginTop: 32 }} aria-labelledby="api-keys-title">
        <h2 id="api-keys-title">API keys</h2>
        <ApiKeyManager initial={apiKeys} />
      </section>
      <section style={{ marginTop: 32 }} aria-labelledby="audit-log-title">
        <h2 id="audit-log-title">Activity log</h2>
        <AuditLogViewer isDomainAdmin={isDomainAdmin} members={domainMembers} />
      </section>
      {isDomainAdmin && <p><a href="/admin/dashboard">Administration</a></p>}
    </main>
  );
}
