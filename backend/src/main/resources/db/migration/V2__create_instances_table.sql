-- Create instances table
CREATE TABLE instances (
    id BIGSERIAL PRIMARY KEY,
    external_id VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    base_url VARCHAR(512) NOT NULL,
    api_key VARCHAR(512) NOT NULL,
    status VARCHAR(50),
    version VARCHAR(50),
    last_seen_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index on external_id for faster lookups
CREATE INDEX idx_instances_external_id ON instances(external_id);

-- Create index on status for filtering
CREATE INDEX idx_instances_status ON instances(status);

-- Create index on last_seen_at for sorting
CREATE INDEX idx_instances_last_seen_at ON instances(last_seen_at);

