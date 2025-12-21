-- Add tenant_id to users
ALTER TABLE users ADD COLUMN tenant_id VARCHAR(255) NOT NULL DEFAULT 'default';
CREATE INDEX idx_users_tenant_id ON users(tenant_id);

-- Add tenant_id to instances
ALTER TABLE instances ADD COLUMN tenant_id VARCHAR(255) NOT NULL DEFAULT 'default';
CREATE INDEX idx_instances_tenant_id ON instances(tenant_id);

-- Update unique constraints
-- Drop existing unique constraint on external_id if it exists
ALTER TABLE instances DROP CONSTRAINT IF EXISTS instances_external_id_key;
-- Add composite unique constraint
ALTER TABLE instances ADD CONSTRAINT instances_external_id_tenant_key UNIQUE (external_id, tenant_id);

