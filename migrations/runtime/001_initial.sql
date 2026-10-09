CREATE TABLE accounts (
 id text PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL,
 password_hash text NOT NULL, role text NOT NULL DEFAULT 'member', verified boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL);
CREATE TABLE verification_tokens (token_hash text PRIMARY KEY, user_id text REFERENCES accounts(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL);
CREATE TABLE entities (id text PRIMARY KEY, kind text NOT NULL, owner_id text NOT NULL REFERENCES accounts(id), title text NOT NULL, body text NOT NULL DEFAULT '', data jsonb NOT NULL DEFAULT '{}', status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX entities_search ON entities(kind,status);
CREATE TABLE memberships (entity_id text REFERENCES entities(id) ON DELETE CASCADE, user_id text REFERENCES accounts(id) ON DELETE CASCADE, status text NOT NULL, position bigserial, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(entity_id,user_id));
CREATE TABLE school_memberships (school_id text REFERENCES entities(id), user_id text REFERENCES accounts(id), verification text NOT NULL DEFAULT 'self-declared', PRIMARY KEY(school_id,user_id));
CREATE TABLE conversations (id text PRIMARY KEY, title text NOT NULL, entity_id text REFERENCES entities(id), created_by text REFERENCES accounts(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE conversation_members (conversation_id text REFERENCES conversations(id) ON DELETE CASCADE, user_id text REFERENCES accounts(id) ON DELETE CASCADE, PRIMARY KEY(conversation_id,user_id));
CREATE TABLE messages (id text PRIMARY KEY, conversation_id text REFERENCES conversations(id) ON DELETE CASCADE, sender_id text REFERENCES accounts(id), body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE notifications (id text PRIMARY KEY, user_id text REFERENCES accounts(id) ON DELETE CASCADE, body text NOT NULL, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE uploads (id text PRIMARY KEY, owner_id text REFERENCES accounts(id), mime text NOT NULL, size integer NOT NULL, filename text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE domain_events (id bigserial PRIMARY KEY, type text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE feature_state (feature text NOT NULL, key text NOT NULL, value jsonb NOT NULL, PRIMARY KEY(feature,key));
