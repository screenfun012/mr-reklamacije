-- Integration test database (separate from dev mr_reklamacije).
-- Init scripts run only on first Docker volume creation; existing volumes
-- are upgraded by integration globalSetup (ensureIntegrationDatabaseExists).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'mr_reklamacije_test') THEN
    CREATE DATABASE mr_reklamacije_test;
  END IF;
END
$$;
