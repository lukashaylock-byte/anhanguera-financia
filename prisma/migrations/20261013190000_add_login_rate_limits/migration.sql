CREATE TABLE "LoginRateLimit" (
    "id" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LoginRateLimit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoginRateLimit_expiresAt_idx" ON "LoginRateLimit"("expiresAt");
