ALTER TABLE instances ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX idx_instances_tenant_archived ON instances(tenant_id, archived_at);

-- No credentials or instance data survive deletion, only temporary slot reservations.
CREATE TABLE instance_slot_locks (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    base_url VARCHAR(512) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_instance_slot_locks_tenant_deleted ON instance_slot_locks(tenant_id, deleted_at);
