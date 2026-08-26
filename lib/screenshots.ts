import { unlink } from "node:fs/promises";
import { db } from "@/lib/db";

export async function deleteScreenshotFiles(paths: (string | null | undefined)[]) {
  await Promise.all(paths.filter((p): p is string => !!p).map(p => unlink(p).catch(() => {})));
}

/**
 * A link's `expiresAt` only cuts off public redirect access (see lib/links/service.ts); it does
 * not delete the ShortLink row itself, which stays a manual admin action. Screenshots are the
 * one exception: they're a copy of third-party page content, so once a link is expired there's
 * no remaining purpose in keeping that copy around, and this purges the files (and clears the
 * path fields) automatically.
 */
export async function purgeExpiredScreenshots(): Promise<number> {
  const expired = await db.shortLink.findMany({
    where: { expiresAt: { lte: new Date() }, OR: [{ screenshotLandscapePath: { not: null } }, { screenshotPortraitPath: { not: null } }] },
    select: { id: true, screenshotLandscapePath: true, screenshotPortraitPath: true },
  });
  for (const link of expired) {
    await deleteScreenshotFiles([link.screenshotLandscapePath, link.screenshotPortraitPath]);
    await db.shortLink.update({ where: { id: link.id }, data: { screenshotLandscapePath: null, screenshotPortraitPath: null } });
  }
  return expired.length;
}
