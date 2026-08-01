-- Lipro Academy — Database Initialization
-- Enables all required PostgreSQL extensions for the application.
-- Run automatically by docker-entrypoint-initdb.d on first container start.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Verify extensions loaded correctly
SELECT extname, extversion
FROM pg_extension
WHERE extname IN ('uuid-ossp', 'vector', 'pg_trgm', 'btree_gin');