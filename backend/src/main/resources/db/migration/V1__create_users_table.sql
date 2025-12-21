-- Create users table
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'USER',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index on username for faster lookups
CREATE INDEX idx_users_username ON users(username);

-- Create index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);

-- Insert default admin user (password: admin123 - should be changed after first login)
-- Password hash is BCrypt encoded (verified working hash)
INSERT INTO users (username, password, email, role, enabled, created_at, updated_at)
VALUES (
    'admin',
    '$2a$10$ecmREtx3dAJkLLNnl7oUr.CMK6tbAPWwX.NkCHb/DwZO5HO/vOAAm',
    'admin@example.com',
    'ADMIN',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

