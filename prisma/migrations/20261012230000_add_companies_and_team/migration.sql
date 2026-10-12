CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'LEITURA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Company" ("id", "name", "createdAt")
SELECT
    substr(hash.value, 1, 8) || '-' || substr(hash.value, 9, 4) || '-' || substr(hash.value, 13, 4) || '-' || substr(hash.value, 17, 4) || '-' || substr(hash.value, 21, 12),
    "User"."fullName" || ' - Empresa',
    "User"."createdAt"
FROM "User"
CROSS JOIN LATERAL (SELECT md5('company:' || "User"."id") AS value) AS hash;

INSERT INTO "Membership" ("id", "userId", "companyId", "role", "createdAt")
SELECT
    substr(hash.value, 1, 8) || '-' || substr(hash.value, 9, 4) || '-' || substr(hash.value, 13, 4) || '-' || substr(hash.value, 17, 4) || '-' || substr(hash.value, 21, 12),
    "User"."id",
    substr(company_hash.value, 1, 8) || '-' || substr(company_hash.value, 9, 4) || '-' || substr(company_hash.value, 13, 4) || '-' || substr(company_hash.value, 17, 4) || '-' || substr(company_hash.value, 21, 12),
    'ADMINISTRADOR',
    "User"."createdAt"
FROM "User"
CROSS JOIN LATERAL (SELECT md5('membership:' || "User"."id") AS value) AS hash
CROSS JOIN LATERAL (SELECT md5('company:' || "User"."id") AS value) AS company_hash;

ALTER TABLE "Transaction" ADD COLUMN "companyId" TEXT;

UPDATE "Transaction"
SET "companyId" = "Membership"."companyId"
FROM "Membership"
WHERE "Transaction"."userId" = "Membership"."userId";

ALTER TABLE "Transaction" ALTER COLUMN "companyId" SET NOT NULL;

CREATE UNIQUE INDEX "Membership_userId_companyId_key" ON "Membership"("userId", "companyId");
CREATE INDEX "Membership_companyId_role_idx" ON "Membership"("companyId", "role");
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
CREATE UNIQUE INDEX "Invitation_companyId_email_key" ON "Invitation"("companyId", "email");
CREATE INDEX "Invitation_companyId_acceptedAt_idx" ON "Invitation"("companyId", "acceptedAt");
CREATE INDEX "Transaction_companyId_date_idx" ON "Transaction"("companyId", "date");

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
