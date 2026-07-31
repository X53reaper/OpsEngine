-- Create separate database for Langfuse if it doesn't exist
-- Note: Running this inside docker-entrypoint-initdb.d on startup
CREATE DATABASE langfuse;
