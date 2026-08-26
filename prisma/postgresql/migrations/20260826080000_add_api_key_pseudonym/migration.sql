-- AlterTable
ALTER TABLE "AuditLogEntry" ADD COLUMN "apiKeyPseudonym" TEXT;

-- CreateIndex
CREATE INDEX "AuditLogEntry_apiKeyPseudonym_idx" ON "AuditLogEntry"("apiKeyPseudonym");
