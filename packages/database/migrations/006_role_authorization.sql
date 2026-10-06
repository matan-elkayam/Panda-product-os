BEGIN;

CREATE OR REPLACE FUNCTION app.current_org_role() RETURNS app_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT om.role
  FROM organization_members om
  WHERE om.organization_id = app.current_org_id()
    AND om.user_id = app.current_user_id()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION app.can_mutate_project() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(app.current_org_role() IN ('OWNER'::app_role, 'ADMIN'::app_role, 'MEMBER'::app_role), false)
$$;

DROP POLICY IF EXISTS projects_org_isolation ON projects;
DROP POLICY IF EXISTS projects_select_org_member ON projects;
DROP POLICY IF EXISTS projects_insert_role ON projects;
DROP POLICY IF EXISTS projects_update_role ON projects;
DROP POLICY IF EXISTS projects_delete_role ON projects;

CREATE POLICY projects_select_org_member ON projects
  FOR SELECT
  USING (
    organization_id = app.current_org_id()
    AND app.is_current_org_member()
  );

CREATE POLICY projects_insert_role ON projects
  FOR INSERT
  WITH CHECK (
    organization_id = app.current_org_id()
    AND app.is_current_org_member()
    AND app.can_mutate_project()
  );

CREATE POLICY projects_update_role ON projects
  FOR UPDATE
  USING (
    organization_id = app.current_org_id()
    AND app.is_current_org_member()
    AND app.can_mutate_project()
  )
  WITH CHECK (
    organization_id = app.current_org_id()
    AND app.is_current_org_member()
    AND app.can_mutate_project()
  );

CREATE POLICY projects_delete_role ON projects
  FOR DELETE
  USING (
    organization_id = app.current_org_id()
    AND app.is_current_org_member()
    AND app.can_mutate_project()
  );

REVOKE ALL ON FUNCTION app.current_org_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.can_mutate_project() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.current_org_role() TO panda_runtime;
GRANT EXECUTE ON FUNCTION app.can_mutate_project() TO panda_runtime;

COMMIT;
