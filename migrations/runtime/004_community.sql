CREATE TABLE creator_profiles (
 user_id text PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
 display_name text NOT NULL, school text NOT NULL DEFAULT '', bio text NOT NULL DEFAULT '',
 tags jsonb NOT NULL DEFAULT '[]', updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE creator_products (
 id text PRIMARY KEY, owner_id text NOT NULL REFERENCES accounts(id),
 name text NOT NULL, tagline text NOT NULL, description text NOT NULL,
 url text NOT NULL DEFAULT '', category text NOT NULL, stage text NOT NULL,
 tags jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX creator_products_owner ON creator_products(owner_id, created_at DESC);
CREATE TABLE community_posts (
 id text PRIMARY KEY, author_id text NOT NULL REFERENCES accounts(id),
 title text NOT NULL, body text NOT NULL, category text NOT NULL,
 tags jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_posts_feed ON community_posts(category, created_at DESC);
CREATE TABLE community_replies (
 id text PRIMARY KEY, post_id text NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
 author_id text NOT NULL REFERENCES accounts(id), body text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_replies_post ON community_replies(post_id, created_at);
CREATE TABLE audit_log (id bigserial PRIMARY KEY, actor_id text, action text NOT NULL, resource_id text, detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
