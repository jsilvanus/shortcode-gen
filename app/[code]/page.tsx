import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getActiveLink } from "@/lib/links/service";
import { recordVisit } from "@/lib/analytics";

export default async function ShortLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const link = await getActiveLink(code);
  if (!link) notFound();
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? requestHeaders.get("x-real-ip") ?? "unknown";
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
