CREATE TABLE module_records (
  id text PRIMARY KEY, module_id text NOT NULL, owner_id text NOT NULL REFERENCES accounts(id),
  title text NOT NULL, data jsonb NOT NULL DEFAULT '{}', status text NOT NULL,
  context_id text REFERENCES module_records(id), archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX module_records_lookup ON module_records(module_id, owner_id, context_id, status);
