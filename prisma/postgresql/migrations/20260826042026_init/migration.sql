-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainAlias" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainMembership" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ShortLink" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "codeType" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastCheckedAt" TIMESTAMP(3),
    "lastChangedAt" TIMESTAMP(3),
    "lastSuccessfulFetchAt" TIMESTAMP(3),
    "lastRenderedAt" TIMESTAMP(3),
    "renderStatus" TEXT NOT NULL DEFAULT 'none',
    "renderError" TEXT,
    "needsRender" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "lastClickedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ShortLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkCollection" (
    "shortLinkId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,

    CONSTRAINT "LinkCollection_pkey" PRIMARY KEY ("shortLinkId","collectionId")
);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "DomainSetting" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "shortLinkId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkVisit" (
    "id" TEXT NOT NULL,
    "shortLinkId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkDailyStat" (
    "id" TEXT NOT NULL,
    "shortLinkId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "redirects" INTEGER NOT NULL DEFAULT 0,
    "uniqueViews" INTEGER NOT NULL DEFAULT 0,
    "uniqueRedirects" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LinkDailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkMonthlyStat" (
    "id" TEXT NOT NULL,
    "shortLinkId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "uniqueViewsHll" TEXT NOT NULL,
    "uniqueRedirectsHll" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkMonthlyStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Domain_hostname_key" ON "Domain"("hostname");

-- CreateIndex
CREATE INDEX "Domain_active_idx" ON "Domain"("active");

-- CreateIndex
CREATE UNIQUE INDEX "DomainAlias_hostname_key" ON "DomainAlias"("hostname");

-- CreateIndex
CREATE INDEX "DomainAlias_domainId_idx" ON "DomainAlias"("domainId");

-- CreateIndex
CREATE INDEX "DomainAlias_active_idx" ON "DomainAlias"("active");

-- CreateIndex
CREATE INDEX "DomainMembership_userId_idx" ON "DomainMembership"("userId");

-- CreateIndex
CREATE INDEX "DomainMembership_domainId_idx" ON "DomainMembership"("domainId");

-- CreateIndex
CREATE UNIQUE INDEX "DomainMembership_domainId_userId_key" ON "DomainMembership"("domainId", "userId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_resetAt_idx" ON "LoginAttempt"("resetAt");

-- CreateIndex
CREATE INDEX "ShortLink_domainId_idx" ON "ShortLink"("domainId");

-- CreateIndex
CREATE INDEX "ShortLink_domainId_ownerId_idx" ON "ShortLink"("domainId", "ownerId");

-- CreateIndex
CREATE INDEX "ShortLink_ownerId_idx" ON "ShortLink"("ownerId");

-- CreateIndex
CREATE INDEX "ShortLink_isPrivate_idx" ON "ShortLink"("isPrivate");

-- CreateIndex
CREATE INDEX "ShortLink_expiresAt_idx" ON "ShortLink"("expiresAt");

-- CreateIndex
CREATE INDEX "ShortLink_active_idx" ON "ShortLink"("active");

-- CreateIndex
CREATE INDEX "ShortLink_needsRender_active_expiresAt_idx" ON "ShortLink"("needsRender", "active", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShortLink_domainId_code_key" ON "ShortLink"("domainId", "code");

-- CreateIndex
CREATE INDEX "Collection_domainId_idx" ON "Collection"("domainId");

-- CreateIndex
CREATE INDEX "Collection_domainId_ownerId_idx" ON "Collection"("domainId", "ownerId");

-- CreateIndex
CREATE INDEX "Collection_ownerId_idx" ON "Collection"("ownerId");

-- CreateIndex
CREATE INDEX "Collection_isPrivate_idx" ON "Collection"("isPrivate");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_domainId_name_key" ON "Collection"("domainId", "name");

-- CreateIndex
CREATE INDEX "LinkCollection_collectionId_idx" ON "LinkCollection"("collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "DomainSetting_domainId_key" ON "DomainSetting"("domainId");

-- CreateIndex
CREATE INDEX "Job_status_runAfter_idx" ON "Job"("status", "runAfter");

-- CreateIndex
CREATE INDEX "Job_shortLinkId_idx" ON "Job"("shortLinkId");

-- CreateIndex
CREATE INDEX "LinkVisit_shortLinkId_createdAt_idx" ON "LinkVisit"("shortLinkId", "createdAt");

-- CreateIndex
CREATE INDEX "LinkVisit_createdAt_idx" ON "LinkVisit"("createdAt");

-- CreateIndex
CREATE INDEX "LinkDailyStat_shortLinkId_date_idx" ON "LinkDailyStat"("shortLinkId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "LinkDailyStat_shortLinkId_date_key" ON "LinkDailyStat"("shortLinkId", "date");

-- CreateIndex
CREATE INDEX "LinkMonthlyStat_shortLinkId_year_month_idx" ON "LinkMonthlyStat"("shortLinkId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "LinkMonthlyStat_shortLinkId_year_month_key" ON "LinkMonthlyStat"("shortLinkId", "year", "month");

-- AddForeignKey
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainAlias" ADD CONSTRAINT "DomainAlias_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainMembership" ADD CONSTRAINT "DomainMembership_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainMembership" ADD CONSTRAINT "DomainMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortLink" ADD CONSTRAINT "ShortLink_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortLink" ADD CONSTRAINT "ShortLink_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkCollection" ADD CONSTRAINT "LinkCollection_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkCollection" ADD CONSTRAINT "LinkCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainSetting" ADD CONSTRAINT "DomainSetting_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkVisit" ADD CONSTRAINT "LinkVisit_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkDailyStat" ADD CONSTRAINT "LinkDailyStat_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkMonthlyStat" ADD CONSTRAINT "LinkMonthlyStat_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
