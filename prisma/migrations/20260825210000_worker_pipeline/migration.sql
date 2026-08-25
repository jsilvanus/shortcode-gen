-- Worker HTTP fingerprint and render state
ALTER TABLE "ShortLink" ADD COLUMN "etag" TEXT;
ALTER TABLE "ShortLink" ADD COLUMN "lastModified" TEXT;
ALTER TABLE "ShortLink" ADD COLUMN "lastChangedAt" DATETIME;
ALTER TABLE "ShortLink" ADD COLUMN "lastRenderedAt" DATETIME;
ALTER TABLE "ShortLink" ADD COLUMN "renderStatus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "ShortLink" ADD COLUMN "renderError" TEXT;
ALTER TABLE "ShortLink" ADD COLUMN "needsRender" BOOLEAN NOT NULL DEFAULT 0;

CREATE INDEX "ShortLink_needsRender_active_expiresAt_idx" ON "ShortLink"("needsRender", "active", "expiresAt");
