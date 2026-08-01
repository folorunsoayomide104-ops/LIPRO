-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Create unleash database
SELECT 'CREATE DATABASE lipro_unleash'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'lipro_unleash')\gexec

-- Connect to unleash database and enable extensions
\c lipro_unleash;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;