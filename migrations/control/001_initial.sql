CREATE TABLE accounts (
 id text PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL,
 password_hash text NOT NULL, role text NOT NULL DEFAULT 'developer', verified boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL);
CREATE TABLE teams (id text PRIMARY KEY, name text NOT NULL, owner_id text NOT NULL REFERENCES accounts(id));
CREATE TABLE team_members (team_id text REFERENCES teams(id), user_id text REFERENCES accounts(id), role text NOT NULL, PRIMARY KEY(team_id,user_id));
CREATE TABLE projects (id text PRIMARY KEY, owner_id text NOT NULL REFERENCES accounts(id), team_id text REFERENCES teams(id), name text NOT NULL, idea text NOT NULL, spec jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE applications (id text PRIMARY KEY, project_id text NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE, spec jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE module_versions (module_id text NOT NULL, version text NOT NULL, manifest jsonb NOT NULL, recipe jsonb, source_project_id text REFERENCES projects(id), owner_id text REFERENCES accounts(id), status text NOT NULL, reviewed_by text REFERENCES accounts(id), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(module_id,version));
CREATE TABLE module_installs (app_id text REFERENCES applications(id) ON DELETE CASCADE, module_id text NOT NULL, version text NOT NULL, configuration jsonb NOT NULL DEFAULT '{}', installed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(app_id,module_id), FOREIGN KEY(module_id,version) REFERENCES module_versions(module_id,version));
CREATE TABLE install_history (id text PRIMARY KEY, app_id text REFERENCES applications(id) ON DELETE CASCADE, before_state jsonb NOT NULL, after_state jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE jobs (id text PRIMARY KEY, project_id text REFERENCES projects(id) ON DELETE CASCADE, owner_id text NOT NULL REFERENCES accounts(id), input text NOT NULL, mode text NOT NULL, status text NOT NULL, plan jsonb, result jsonb, error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE job_events (id bigserial PRIMARY KEY, job_id text NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, type text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE deployments (id text PRIMARY KEY, app_id text REFERENCES applications(id) ON DELETE CASCADE, owner_id text NOT NULL REFERENCES accounts(id), status text NOT NULL, provider text NOT NULL, port integer, pid integer, artifact text, spec jsonb NOT NULL, previous_id text REFERENCES deployments(id), logs text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE app_secrets (app_id text REFERENCES applications(id) ON DELETE CASCADE, name text NOT NULL, encrypted_value text NOT NULL, PRIMARY KEY(app_id,name));
CREATE TABLE audit_log (id bigserial PRIMARY KEY, actor_id text, action text NOT NULL, resource_id text, detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE cross_app_grants (id text PRIMARY KEY, source_app text REFERENCES applications(id), target_app text REFERENCES applications(id), approved_by text REFERENCES accounts(id), contract jsonb NOT NULL, revoked_at timestamptz);
