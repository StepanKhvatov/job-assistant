-- CreateTable
CREATE TABLE "vacancies" (
    "id" TEXT NOT NULL,
    "hh_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT,
    "salary" TEXT,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vacancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analyses" (
    "id" TEXT NOT NULL,
    "vacancy_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "summary" TEXT,
    "pros" JSONB,
    "cons" JSONB,
    "apply_decision" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "vacancy_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "cover_letter" TEXT,
    "applied_at" TIMESTAMP(3),
    "response" TEXT,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vacancies_hh_id_key" ON "vacancies"("hh_id");

-- CreateIndex
CREATE INDEX "analyses_vacancy_id_idx" ON "analyses"("vacancy_id");

-- CreateIndex
CREATE INDEX "analyses_score_idx" ON "analyses"("score");

-- CreateIndex
CREATE INDEX "applications_vacancy_id_idx" ON "applications"("vacancy_id");

-- CreateIndex
CREATE INDEX "applications_status_idx" ON "applications"("status");

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_vacancy_id_fkey" FOREIGN KEY ("vacancy_id") REFERENCES "vacancies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_vacancy_id_fkey" FOREIGN KEY ("vacancy_id") REFERENCES "vacancies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
