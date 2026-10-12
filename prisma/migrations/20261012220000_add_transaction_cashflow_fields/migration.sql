ALTER TABLE "Transaction"
ADD COLUMN "dueDate" TIMESTAMP(3),
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PAGO',
ADD COLUMN "costCenter" TEXT NOT NULL DEFAULT 'Geral';

UPDATE "Transaction"
SET "dueDate" = "date"
WHERE "dueDate" IS NULL;
