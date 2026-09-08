CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'DISABLED');
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');

CREATE TABLE "organizations" ("id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "organizations_pkey" PRIMARY KEY ("id"));
CREATE TABLE "companies" ("id" UUID NOT NULL DEFAULT gen_random_uuid(), "organization_id" UUID NOT NULL, "legal_name" TEXT NOT NULL, "tax_id" VARCHAR(40) NOT NULL, "country" CHAR(2) NOT NULL DEFAULT 'ES', "base_currency" CHAR(3) NOT NULL DEFAULT 'EUR', "timezone" VARCHAR(64) NOT NULL DEFAULT 'Europe/Madrid', "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "companies_pkey" PRIMARY KEY ("id"));
CREATE TABLE "users" ("id" UUID NOT NULL DEFAULT gen_random_uuid(), "email" CITEXT NOT NULL, "password_hash" TEXT, "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "users_pkey" PRIMARY KEY ("id"));
CREATE TABLE "roles" ("id" UUID NOT NULL DEFAULT gen_random_uuid(), "code" VARCHAR(80) NOT NULL, "name" TEXT NOT NULL, CONSTRAINT "roles_pkey" PRIMARY KEY ("id"));
CREATE TABLE "memberships" ("id" UUID NOT NULL DEFAULT gen_random_uuid(), "organization_id" UUID NOT NULL, "company_id" UUID, "user_id" UUID NOT NULL, "role_id" UUID NOT NULL, "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE', CONSTRAINT "memberships_pkey" PRIMARY KEY ("id"));
CREATE TABLE "audit_events" ("id" UUID NOT NULL DEFAULT gen_random_uuid(), "organization_id" UUID NOT NULL, "company_id" UUID, "actor_user_id" UUID, "action" VARCHAR(160) NOT NULL, "entity_type" VARCHAR(100) NOT NULL, "entity_id" UUID, "metadata" JSONB NOT NULL DEFAULT '{}', "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id"));

CREATE UNIQUE INDEX "companies_organization_id_tax_id_key" ON "companies"("organization_id", "tax_id");
CREATE INDEX "companies_organization_id_idx" ON "companies"("organization_id");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");
CREATE UNIQUE INDEX "memberships_organization_id_company_id_user_id_role_id_key" ON "memberships"("organization_id", "company_id", "user_id", "role_id");
CREATE INDEX "memberships_user_id_organization_id_company_id_idx" ON "memberships"("user_id", "organization_id", "company_id");
CREATE INDEX "audit_events_organization_id_company_id_occurred_at_idx" ON "audit_events"("organization_id", "company_id", "occurred_at");

ALTER TABLE "companies" ADD CONSTRAINT "companies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Defense in depth: application requests set app.organization_id before tenant queries.
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "companies_organization_isolation" ON "companies" USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
CREATE POLICY "audit_events_organization_isolation" ON "audit_events" USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
