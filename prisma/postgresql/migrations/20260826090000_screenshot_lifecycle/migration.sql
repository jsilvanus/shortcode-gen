-- Split the single screenshot into orientation-specific variants, add an opt-out flag, and a
-- per-link redirect-delay override.
ALTER TABLE "ShortLink" DROP COLUMN "screenshotPath";
ALTER TABLE "ShortLink" ADD COLUMN "screenshotLandscapePath" TEXT;
ALTER TABLE "ShortLink" ADD COLUMN "screenshotPortraitPath" TEXT;
ALTER TABLE "ShortLink" ADD COLUMN "screenshotDisabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShortLink" ADD COLUMN "redirectDelaySeconds" INTEGER;

-- CreateTable
CREATE TABLE "LinkComplaint" (
    "id" TEXT NOT NULL,
    "shortLinkId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "LinkComplaint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LinkComplaint_shortLinkId_idx" ON "LinkComplaint"("shortLinkId");

-- CreateIndex
CREATE INDEX "LinkComplaint_createdAt_idx" ON "LinkComplaint"("createdAt");

-- AddForeignKey
ALTER TABLE "LinkComplaint" ADD CONSTRAINT "LinkComplaint_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
