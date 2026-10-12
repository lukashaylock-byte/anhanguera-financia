ALTER TABLE "User"
    ADD COLUMN "fullNameEncrypted" TEXT,
    ADD COLUMN "emailEncrypted" TEXT,
    ADD COLUMN "emailLookupHash" TEXT,
    ADD COLUMN "cpfEncrypted" TEXT,
    ADD COLUMN "cpfLookupHash" TEXT,
    ADD COLUMN "birthDateEncrypted" TEXT;

CREATE UNIQUE INDEX "User_emailLookupHash_key" ON "User"("emailLookupHash");
CREATE UNIQUE INDEX "User_cpfLookupHash_key" ON "User"("cpfLookupHash");

ALTER TABLE "Invitation"
    ADD COLUMN "emailEncrypted" TEXT,
    ADD COLUMN "emailLookupHash" TEXT;

DROP INDEX "Invitation_companyId_email_key";
CREATE UNIQUE INDEX "Invitation_companyId_emailLookupHash_key"
    ON "Invitation"("companyId", "emailLookupHash");

ALTER TABLE "User"
    ALTER COLUMN "fullName" DROP NOT NULL,
    ALTER COLUMN "email" DROP NOT NULL,
    ALTER COLUMN "cpf" DROP NOT NULL,
    ALTER COLUMN "birthDate" DROP NOT NULL;

ALTER TABLE "Invitation"
    ALTER COLUMN "email" DROP NOT NULL;
