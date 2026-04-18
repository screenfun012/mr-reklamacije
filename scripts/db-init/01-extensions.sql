-- Extensions required by @mr/db (see docs/02-data-model.md)
-- citext: case-insensitive email columns
-- uuid-ossp / pgcrypto: UUID and crypto helpers
-- pg_trgm: text search / similarity (indexes as needed in migrations)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
