-- Integration test database (separate from dev mr_reklamacije).
-- Init scripts run only on first Docker volume creation; existing volumes
-- are upgraded by integration globalSetup (ensureIntegrationDatabaseExists).
-- \gexec runs CREATE DATABASE as a top-level command (not inside DO/PLpgSQL).
SELECT 'CREATE DATABASE mr_reklamacije_test'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'mr_reklamacije_test'
);
\gexec
