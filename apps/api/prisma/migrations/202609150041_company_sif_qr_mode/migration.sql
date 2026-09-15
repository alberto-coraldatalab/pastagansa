CREATE TYPE "SifMode" AS ENUM ('DISABLED', 'NO_VERIFACTU', 'VERIFACTU');
CREATE TYPE "AeatEnvironment" AS ENUM ('TEST', 'PRODUCTION');

ALTER TABLE "companies"
  ADD COLUMN "sif_mode" "SifMode" NOT NULL DEFAULT 'DISABLED',
  ADD COLUMN "aeat_environment" "AeatEnvironment" NOT NULL DEFAULT 'PRODUCTION';

ALTER TABLE "invoices"
  ADD COLUMN "sif_mode" "SifMode" NOT NULL DEFAULT 'DISABLED',
  ADD COLUMN "aeat_environment" "AeatEnvironment" NOT NULL DEFAULT 'PRODUCTION';
