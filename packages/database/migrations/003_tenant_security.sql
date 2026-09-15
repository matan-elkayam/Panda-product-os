BEGIN;

CREATE SCHEMA IF NOT EXISTS app;

CREATE FUNCTION app.current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

CREATE FUNCTION app.current_org_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.org_id', true), '')::uuid
$$;

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspaces_org_isolation ON workspaces
  USING (organization_id = app.current_org_id())
  WITH CHECK (organization_id = app.current_org_id());

CREATE POLICY projects_org_isolation ON projects
  USING (organization_id = app.current_org_id())
  WITH CHECK (organization_id = app.current_org_id());

CREATE POLICY memberships_self_org ON organization_members
  USING (organization_id = app.current_org_id() AND user_id = app.current_user_id());

COMMIT;
