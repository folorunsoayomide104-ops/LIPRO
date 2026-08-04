-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create DocumentChunk table
CREATE TABLE "DocumentChunk" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes
CREATE INDEX "DocumentChunk_materialId_idx" ON "DocumentChunk"("materialId");
CREATE INDEX "DocumentChunk_userId_idx" ON "DocumentChunk"("userId");
CREATE INDEX "DocumentChunk_materialId_chunkIndex_idx" ON "DocumentChunk"("materialId", "chunkIndex");

-- Add documentChunks relation to User and Material tables (handled by Prisma client)
-- Note: The schema.prisma already defines the relations