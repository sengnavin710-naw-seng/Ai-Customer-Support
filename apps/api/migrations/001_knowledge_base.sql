-- Forward-only, additive migration. Never resets existing volumes or domain data.
CREATE TABLE kb_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX kb_categories_name_unique ON kb_categories (lower(btrim(name)));

CREATE TABLE kb_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES kb_categories(id) ON DELETE RESTRICT,
  current_version integer NOT NULL DEFAULT 1 CHECK (current_version > 0),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by text NOT NULL,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kb_articles_category_idx ON kb_articles(category_id);
CREATE INDEX kb_articles_updated_idx ON kb_articles(updated_at DESC, id DESC);

CREATE TABLE kb_article_versions (
  article_id uuid NOT NULL REFERENCES kb_articles(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  category_id uuid NOT NULL REFERENCES kb_categories(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 10000),
  language text NOT NULL CHECK (language IN ('my', 'en')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','approved','rejected')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_by text,
  submitted_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text CHECK (char_length(review_note) <= 1000),
  PRIMARY KEY (article_id, version),
  CHECK ((status = 'draft' AND submitted_by IS NULL AND submitted_at IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL AND review_note IS NULL)
    OR (status = 'pending' AND submitted_by IS NOT NULL AND submitted_at IS NOT NULL AND reviewed_by IS NULL AND reviewed_at IS NULL AND review_note IS NULL)
    OR (status IN ('approved','rejected') AND submitted_by IS NOT NULL AND submitted_at IS NOT NULL AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)),
  CHECK (status <> 'rejected' OR char_length(btrim(review_note)) > 0 AND review_note IS NOT NULL)
);
ALTER TABLE kb_articles ADD CONSTRAINT kb_articles_current_version_fk
  FOREIGN KEY(id, current_version) REFERENCES kb_article_versions(article_id, version)
  DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX kb_versions_status_idx ON kb_article_versions(status, article_id, version);
CREATE INDEX kb_versions_category_idx ON kb_article_versions(category_id);

CREATE TABLE kb_audit_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text NOT NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('admin','agent')),
  action text NOT NULL CHECK (action IN ('category.created','category.updated','category.deleted','article.created','article.versioned','article.submitted','article.approved','article.rejected','article.archived')),
  entity_id uuid NOT NULL,
  version integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kb_audit_entity_idx ON kb_audit_records(entity_id, created_at DESC, id DESC);
CREATE INDEX kb_audit_created_idx ON kb_audit_records(created_at DESC, id DESC);

CREATE FUNCTION kb_protect_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Article history cannot be deleted'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN RAISE EXCEPTION 'New versions must be drafts'; END IF;
    RETURN NEW;
  END IF;
  IF (NEW.article_id, NEW.version, NEW.category_id, NEW.title, NEW.body, NEW.language, NEW.created_by, NEW.created_at)
    IS DISTINCT FROM (OLD.article_id, OLD.version, OLD.category_id, OLD.title, OLD.body, OLD.language, OLD.created_by, OLD.created_at)
    THEN RAISE EXCEPTION 'Version content is immutable'; END IF;
  IF NOT ((OLD.status = 'draft' AND NEW.status = 'pending') OR
          (OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected')))
    THEN RAISE EXCEPTION 'Invalid approval transition'; END IF;
  IF OLD.status = 'pending' AND (NEW.submitted_by, NEW.submitted_at) IS DISTINCT FROM (OLD.submitted_by, OLD.submitted_at)
    THEN RAISE EXCEPTION 'Submission metadata is immutable'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER kb_versions_protect BEFORE INSERT OR UPDATE OR DELETE ON kb_article_versions
  FOR EACH ROW EXECUTE FUNCTION kb_protect_version();

CREATE FUNCTION kb_protect_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit records are append-only'; END;
$$;
CREATE TRIGGER kb_audit_protect BEFORE UPDATE OR DELETE ON kb_audit_records
  FOR EACH ROW EXECUTE FUNCTION kb_protect_audit();

-- This is the only future retrieval boundary. No AI endpoint is implemented.
-- A new draft immediately removes the article from this view until approved.
CREATE VIEW kb_approved_articles AS
SELECT a.id, a.category_id, v.version, v.title, v.body, v.language, v.reviewed_at
FROM kb_articles a JOIN kb_article_versions v ON v.article_id = a.id AND v.version = a.current_version
WHERE a.archived_at IS NULL AND v.status = 'approved';
