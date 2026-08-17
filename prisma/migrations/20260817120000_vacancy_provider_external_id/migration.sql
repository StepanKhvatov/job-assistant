-- CreateEnum
CREATE TYPE "JobBoardProvider" AS ENUM ('hh', 'linkedin');

-- AlterTable
ALTER TABLE "vacancies" ADD COLUMN "provider" "JobBoardProvider";
ALTER TABLE "vacancies" ADD COLUMN "external_id" TEXT;

UPDATE "vacancies" SET "provider" = 'hh', "external_id" = "hh_id";

ALTER TABLE "vacancies" ALTER COLUMN "provider" SET NOT NULL;
ALTER TABLE "vacancies" ALTER COLUMN "external_id" SET NOT NULL;

DROP INDEX "vacancies_hh_id_key";
ALTER TABLE "vacancies" DROP COLUMN "hh_id";

CREATE UNIQUE INDEX "vacancies_provider_external_id_key" ON "vacancies"("provider", "external_id");
CREATE INDEX "vacancies_provider_idx" ON "vacancies"("provider");
