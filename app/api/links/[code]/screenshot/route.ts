import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { getActiveLink } from "@/lib/links/service";
import { getCurrentDomain } from "@/lib/domain-context";

/**
 * Screenshots are meant to be shown on the public link-preview page itself, so this follows the
 * same access rule as that page (`app/[code]/page.tsx`): anyone who can resolve the short code
 * to an active link can see its preview, private or not — the code is the access boundary here,
 * not domain membership.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let domain;
  try {
    domain = await getCurrentDomain();
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const link = await getActiveLink(domain.id, code);
  if (!link || link.screenshotDisabled) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const variant = new URL(request.url).searchParams.get("variant") === "portrait" ? "portrait" : "landscape";
  const path = variant === "portrait" ? link.screenshotPortraitPath : link.screenshotLandscapePath;
  if (!path) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const data = await readFile(path);
    return new NextResponse(new Uint8Array(data), { headers: { "content-type": "image/png", "cache-control": "private, max-age=300" } });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
