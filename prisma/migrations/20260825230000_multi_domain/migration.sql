PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "Domain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hostname" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "Domain_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Domain_hostname_key" ON "Domain"("hostname");
CREATE INDEX "Domain_active_idx" ON "Domain"("active");

CREATE TABLE "DomainMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domainId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DomainMembership_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DomainMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DomainMembership_domainId_userId_key" ON "DomainMembership"("domainId", "userId");
CREATE INDEX "DomainMembership_userId_idx" ON "DomainMembership"("userId");
CREATE INDEX "DomainMembership_domainId_idx" ON "DomainMembership"("domainId");

-- Keep the existing single-domain installation usable after the migration.
INSERT INTO "Domain" ("id", "hostname", "name", "active", "updatedAt")
VALUES ('legacy-domain', 'localhost', 'Default domain', 1, CURRENT_TIMESTAMP);

INSERT INTO "DomainMembership" ("id", "domainId", "userId", "role", "createdAt", "updatedAt")
SELECT 'legacy-membership-' || "id", 'legacy-domain', "id",
       CASE WHEN "role" = 'ADMIN' THEN 'ADMIN' ELSE 'USER' END,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User";

CREATE TABLE "new_ShortLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domainId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "codeType" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT 1,
    "title" TEXT,
    "description" TEXT,
    "canonicalUrl" TEXT,
    "imageUrl" TEXT,
    "faviconUrl" TEXT,
    "screenshotPath" TEXT,
    "metadataSource" TEXT,
    "contentHash" TEXT,
    "etag" TEXT,
    "lastModified" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastCheckedAt" DATETIME,
    "lastChangedAt" DATETIME,
    "lastSuccessfulFetchAt" DATETIME,
    "lastRenderedAt" DATETIME,
    "renderStatus" TEXT NOT NULL DEFAULT 'none',
    "renderError" TEXT,
    "needsRender" BOOLEAN NOT NULL DEFAULT 0,
    "expiresAt" DATETIME,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "lastClickedAt" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT 1,
    CONSTRAINT "ShortLink_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShortLink_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_ShortLink" (
    "id", "domainId", "code", "codeType", "targetUrl", "ownerId", "isPrivate",
    "title", "description", "canonicalUrl", "imageUrl", "faviconUrl", "screenshotPath",
    "metadataSource", "contentHash", "etag", "lastModified", "createdAt", "updatedAt",
    "lastCheckedAt", "lastChangedAt", "lastSuccessfulFetchAt", "lastRenderedAt", "renderStatus",
    "renderError", "needsRender", "expiresAt", "clickCount", "lastClickedAt", "active"
)
SELECT
    "id", 'legacy-domain', "code", "codeType", "targetUrl", "ownerId", "isPrivate",
    "title", "description", "canonicalUrl", "imageUrl", "faviconUrl", "screenshotPath",
    "metadataSource", "contentHash", "etag", "lastModified", "createdAt", "updatedAt",
    "lastCheckedAt", "lastChangedAt", "lastSuccessfulFetchAt", "lastRenderedAt", "renderStatus",
    "renderError", "needsRender", "expiresAt", "clickCount", "lastClickedAt", "active"
FROM "ShortLink";

DROP TABLE "ShortLink";
ALTER TABLE "new_ShortLink" RENAME TO "ShortLink";

CREATE UNIQUE INDEX "ShortLink_domainId_code_key" ON "ShortLink"("domainId", "code");
CREATE INDEX "ShortLink_domainId_idx" ON "ShortLink"("domainId");
CREATE INDEX "ShortLink_domainId_ownerId_idx" ON "ShortLink"("domainId", "ownerId");
CREATE INDEX "ShortLink_ownerId_idx" ON "ShortLink"("ownerId");
CREATE INDEX "ShortLink_isPrivate_idx" ON "ShortLink"("isPrivate");
CREATE INDEX "ShortLink_expiresAt_idx" ON "ShortLink"("expiresAt");
CREATE INDEX "ShortLink_active_idx" ON "ShortLink"("active");
CREATE INDEX "ShortLink_needsRender_active_expiresAt_idx" ON "ShortLink"("needsRender", "active", "expiresAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
