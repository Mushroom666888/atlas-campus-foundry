ALTER TABLE projects ADD COLUMN deleted_at timestamptz;
CREATE INDEX projects_owner_active ON projects(owner_id, updated_at DESC) WHERE deleted_at IS NULL;
