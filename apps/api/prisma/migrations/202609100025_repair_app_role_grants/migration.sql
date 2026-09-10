-- Existing PostgreSQL volumes may predate the app-role default privileges.
-- Repair current objects and keep future migrations accessible to the runtime role.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pastagansa_app') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA public TO pastagansa_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pastagansa_app';
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pastagansa_app';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pastagansa_app';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO pastagansa_app';
  END IF;
END
$$;
