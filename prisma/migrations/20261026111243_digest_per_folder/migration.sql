-- AlterTable
ALTER TABLE "Digest" ADD COLUMN     "label" TEXT NOT NULL DEFAULT 'Tous les articles',
ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'all';

-- CreateIndex
CREATE INDEX "Digest_userId_scope_createdAt_idx" ON "Digest"("userId", "scope", "createdAt");
