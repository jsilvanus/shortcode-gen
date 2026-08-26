import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getActiveLink } from "@/lib/links/service";
import { getCurrentDomain } from "@/lib/domain-context";
import { recordVisit } from "@/lib/analytics";
import { getTrustedClientIp } from "@/lib/security/client-ip";

export default async function ShortLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let domain;
  try {
    domain = await getCurrentDomain();
  } catch {
    notFound();
  }

  const link = await getActiveLink(domain.id, code);
  if (!link) notFound();
  const requestHeaders = await headers();
  const ip = getTrustedClientIp(requestHeaders);
  const userAgent = requestHeaders.get("user-agent") ?? "unknown";
  await recordVisit({ shortLinkId: link.id, eventType: "PAGE_VIEW", ip, userAgent });

  return (
    <main>
      <h1>{link.title || `Short link ${link.code}`}</h1>
      {link.description && <p>{link.description}</p>}
      <p>This link will take you to:</p>
      <p><code>{link.targetUrl}</code></p>
      <form action={async () => { await recordVisit({ shortLinkId: link.id, eventType: "REDIRECT", ip, userAgent }); redirect(link.targetUrl); }}>
        <button type="submit">Continue</button>
      </form>
    </main>
  );
}
