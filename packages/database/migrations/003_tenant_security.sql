BEGIN;

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app.current_org_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.org_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app.is_current_org_member() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = app.current_org_id()
      AND om.user_id = app.current_user_id()
  )
$$;

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces FORCE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
ALTER TABLE organization_members FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspaces_org_isolation ON workspaces;
DROP POLICY IF EXISTS projects_org_isolation ON projects;
DROP POLICY IF EXISTS memberships_self_org ON organization_members;

CREATE POLICY workspaces_org_isolation ON workspaces
  USING (organization_id = app.current_org_id() AND app.is_current_org_member())
  WITH CHECK (organization_id = app.current_org_id() AND app.is_current_org_member());

CREATE POLICY projects_org_isolation ON projects
  USING (organization_id = app.current_org_id() AND app.is_current_org_member())
  WITH CHECK (organization_id = app.current_org_id() AND app.is_current_org_member());

CREATE POLICY memberships_self_org ON organization_members
  USING (organization_id = app.current_org_id() AND user_id = app.current_user_id());

REVOKE ALL ON SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO PUBLIC;
GRANT EXECUTE ON FUNCTION app.current_user_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION app.current_org_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION app.is_current_org_member() TO PUBLIC;

COMMIT;
