ALTER TABLE "AuditLogEntry" ADD COLUMN "apiKeyPseudonym" TEXT;
CREATE INDEX "AuditLogEntry_apiKeyPseudonym_idx" ON "AuditLogEntry"("apiKeyPseudonym");
