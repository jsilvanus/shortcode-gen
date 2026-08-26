-- Make LinkMonthlyStat's HLL columns nullable and add scalar estimate columns, so a closed
-- year's sketches can be collapsed to plain numbers instead of being kept indefinitely.
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LinkMonthlyStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shortLinkId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "uniqueViewsHll" TEXT,
    "uniqueRedirectsHll" TEXT,
    "uniqueViewsEstimate" INTEGER,
    "uniqueRedirectsEstimate" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LinkMonthlyStat_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LinkMonthlyStat" ("id", "shortLinkId", "year", "month", "uniqueViewsHll", "uniqueRedirectsHll", "createdAt", "updatedAt")
SELECT "id", "shortLinkId", "year", "month", "uniqueViewsHll", "uniqueRedirectsHll", "createdAt", "updatedAt" FROM "LinkMonthlyStat";
DROP TABLE "LinkMonthlyStat";
ALTER TABLE "new_LinkMonthlyStat" RENAME TO "LinkMonthlyStat";
CREATE UNIQUE INDEX "LinkMonthlyStat_shortLinkId_year_month_key" ON "LinkMonthlyStat"("shortLinkId", "year", "month");
CREATE INDEX "LinkMonthlyStat_shortLinkId_year_month_idx" ON "LinkMonthlyStat"("shortLinkId", "year", "month");
PRAGMA foreign_keys=ON;

CREATE TABLE "LinkYearlyStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shortLinkId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "uniqueViews" INTEGER NOT NULL,
    "uniqueRedirects" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LinkYearlyStat_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LinkYearlyStat_shortLinkId_year_key" ON "LinkYearlyStat"("shortLinkId", "year");
CREATE INDEX "LinkYearlyStat_shortLinkId_year_idx" ON "LinkYearlyStat"("shortLinkId", "year");
