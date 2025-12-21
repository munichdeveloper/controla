CREATE TABLE alert_settings (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    notify_on_instance_offline BOOLEAN NOT NULL DEFAULT FALSE,
    notify_on_workflow_error BOOLEAN NOT NULL DEFAULT FALSE,
    notify_on_invalid_api_key BOOLEAN NOT NULL DEFAULT FALSE,
    tenant_id VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

