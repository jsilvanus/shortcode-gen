import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getActiveLink } from "@/lib/links/service";
import { getCurrentDomain } from "@/lib/domain-context";
import { getDomainSettings } from "@/lib/settings";
import { recordVisit } from "@/lib/analytics";
import { getTrustedClientIp } from "@/lib/security/client-ip";
import { LinkRedirect } from "@/components/links/link-redirect";
import { LinkComplaintForm } from "@/components/links/link-complaint-form";

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

  const settings = await getDomainSettings(domain.id);
  const delaySeconds = Math.max(3, link.redirectDelaySeconds ?? settings.linkPolicy.redirectDelaySeconds);
  const hasScreenshot = !link.screenshotDisabled && (link.screenshotLandscapePath || link.screenshotPortraitPath);

  return (
    <main>
      <h1>{link.title || `Short link ${link.code}`}</h1>
      {link.description && <p>{link.description}</p>}
      {hasScreenshot && (
        <picture>
          {link.screenshotPortraitPath && <source media="(max-width: 600px)" srcSet={`/api/links/${encodeURIComponent(link.code)}/screenshot?variant=portrait`} />}
          <img src={`/api/links/${encodeURIComponent(link.code)}/screenshot?variant=landscape`} alt={`Preview of ${link.targetUrl}`} width={640} height={360} style={{ maxWidth: "100%", height: "auto" }} />
        </picture>
      )}
      <p>This link will take you to:</p>
      <p><code>{link.targetUrl}</code></p>
      <LinkRedirect code={link.code} targetUrl={link.targetUrl} delaySeconds={delaySeconds} />
      <LinkComplaintForm code={link.code} />
    </main>
  );
}
