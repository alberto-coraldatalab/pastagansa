ALTER TABLE "companies"
  ADD COLUMN "sif_software_producer_name" varchar(240),
  ADD COLUMN "sif_software_producer_tax_id" varchar(40),
  ADD COLUMN "sif_software_name" varchar(120),
  ADD COLUMN "sif_software_id" varchar(120),
  ADD COLUMN "sif_software_version" varchar(60),
  ADD COLUMN "sif_installation_number" varchar(120);

ALTER TABLE "sif_records"
  ADD COLUMN "software_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb;
