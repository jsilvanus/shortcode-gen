PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Aliases are alternate public hostnames for an existing canonical Domain.
CREATE TABLE "DomainAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domainId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DomainAlias_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DomainAlias_hostname_key" ON "DomainAlias"("hostname");
CREATE INDEX "DomainAlias_domainId_idx" ON "DomainAlias"("domainId");
CREATE INDEX "DomainAlias_active_idx" ON "DomainAlias"("active");

-- Domain-scoped settings replace the assumption that one SiteSetting applies to every hostname.
CREATE TABLE "DomainSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domainId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DomainSetting_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DomainSetting_domainId_key" ON "DomainSetting"("domainId");

-- Existing collections belong to the legacy domain created by the previous migration.
CREATE TABLE "new_Collection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domainId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Collection_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Collection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_Collection" (
    "id", "domainId", "name", "description", "ownerId", "isPrivate", "createdAt", "updatedAt"
)
SELECT
    "id", 'legacy-domain', "name", "description", "ownerId", "isPrivate", "createdAt", "updatedAt"
FROM "Collection";

-- Rebuild the join table so its foreign key points at the rebuilt Collection table.
CREATE TABLE "new_LinkCollection" (
    "shortLinkId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    CONSTRAINT "LinkCollection_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LinkCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("shortLinkId", "collectionId")
);
INSERT INTO "new_LinkCollection" ("shortLinkId", "collectionId")
SELECT "shortLinkId", "collectionId" FROM "LinkCollection";

DROP TABLE "LinkCollection";
DROP TABLE "Collection";
ALTER TABLE "new_Collection" RENAME TO "Collection";
ALTER TABLE "new_LinkCollection" RENAME TO "LinkCollection";

CREATE UNIQUE INDEX "Collection_domainId_name_key" ON "Collection"("domainId", "name");
CREATE INDEX "Collection_domainId_idx" ON "Collection"("domainId");
CREATE INDEX "Collection_domainId_ownerId_idx" ON "Collection"("domainId", "ownerId");
CREATE INDEX "Collection_ownerId_idx" ON "Collection"("ownerId");
CREATE INDEX "Collection_isPrivate_idx" ON "Collection"("isPrivate");
CREATE INDEX "LinkCollection_collectionId_idx" ON "LinkCollection"("collectionId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
