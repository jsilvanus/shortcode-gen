-- Split the single screenshot into orientation-specific variants, add an opt-out flag, and a
-- per-link redirect-delay override.
ALTER TABLE "ShortLink" DROP COLUMN "screenshotPath";
ALTER TABLE "ShortLink" ADD COLUMN "screenshotLandscapePath" TEXT;
ALTER TABLE "ShortLink" ADD COLUMN "screenshotPortraitPath" TEXT;
ALTER TABLE "ShortLink" ADD COLUMN "screenshotDisabled" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "ShortLink" ADD COLUMN "redirectDelaySeconds" INTEGER;

CREATE TABLE "LinkComplaint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shortLinkId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "LinkComplaint_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "LinkComplaint_shortLinkId_idx" ON "LinkComplaint"("shortLinkId");
CREATE INDEX "LinkComplaint_createdAt_idx" ON "LinkComplaint"("createdAt");
