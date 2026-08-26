-- Make LinkMonthlyStat's HLL columns nullable and add scalar estimate columns, so a closed
-- year's sketches can be collapsed to plain numbers instead of being kept indefinitely.
ALTER TABLE "LinkMonthlyStat" ALTER COLUMN "uniqueViewsHll" DROP NOT NULL;
ALTER TABLE "LinkMonthlyStat" ALTER COLUMN "uniqueRedirectsHll" DROP NOT NULL;
ALTER TABLE "LinkMonthlyStat" ADD COLUMN "uniqueViewsEstimate" INTEGER;
ALTER TABLE "LinkMonthlyStat" ADD COLUMN "uniqueRedirectsEstimate" INTEGER;

-- CreateTable
CREATE TABLE "LinkYearlyStat" (
    "id" TEXT NOT NULL,
    "shortLinkId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "uniqueViews" INTEGER NOT NULL,
    "uniqueRedirects" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkYearlyStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LinkYearlyStat_shortLinkId_year_key" ON "LinkYearlyStat"("shortLinkId", "year");

-- CreateIndex
CREATE INDEX "LinkYearlyStat_shortLinkId_year_idx" ON "LinkYearlyStat"("shortLinkId", "year");

-- AddForeignKey
ALTER TABLE "LinkYearlyStat" ADD CONSTRAINT "LinkYearlyStat_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
