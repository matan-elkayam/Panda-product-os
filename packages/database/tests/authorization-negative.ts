import assert from 'node:assert/strict';
import { Pool, type PoolClient } from 'pg';

const runtimeUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
if (!runtimeUrl) throw new Error('DATABASE_URL is required');
if (!migrationUrl) throw new Error('MIGRATION_DATABASE_URL is required');

const adminPool = new Pool({ connectionString: migrationUrl, max: 1 });
const runtimePool = new Pool({ connectionString: runtimeUrl, max: 1 });

async function context(client: PoolClient, userId: string, orgId: string) {
  await client.query(
    `SELECT set_config('app.user_id', $1, true), set_config('app.org_id', $2, true)`,
    [userId, orgId],
  );
}

async function main() {
  const admin = await adminPool.connect();
  const runtime = await runtimePool.connect();
  const suffix = Date.now().toString();
  try {
    const identity = await runtime.query('SELECT current_user, session_user');
    assert.equal(identity.rows[0]?.current_user, 'panda_app', 'runtime must be panda_app');

    await admin.query('BEGIN');
    const owner = (await admin.query(`INSERT INTO users(email,name) VALUES ($1,'Owner') RETURNING id`, [`owner-${suffix}@test.local`])).rows[0].id;
    const viewer = (await admin.query(`INSERT INTO users(email,name) VALUES ($1,'Viewer') RETURNING id`, [`viewer-${suffix}@test.local`])).rows[0].id;
    const client = (await admin.query(`INSERT INTO users(email,name) VALUES ($1,'Client') RETURNING id`, [`client-${suffix}@test.local`])).rows[0].id;
    const outsider = (await admin.query(`INSERT INTO users(email,name) VALUES ($1,'Outsider') RETURNING id`, [`outsider-${suffix}@test.local`])).rows[0].id;
    const org = (await admin.query(`INSERT INTO organizations(name,slug) VALUES ('Authz Org',$1) RETURNING id`, [`authz-${suffix}`])).rows[0].id;

    await context(admin, owner, org);
    await admin.query(`INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'OWNER')`, [org, owner]);
    const ws = (await admin.query(`INSERT INTO workspaces(organization_id,name,slug) VALUES ($1,'Authz',$2) RETURNING id`, [org, `authz-${suffix}`])).rows[0].id;
    const project = (await admin.query(`INSERT INTO projects(organization_id,workspace_id,name,slug,created_by) VALUES ($1,$2,'Protected',$3,$4) RETURNING id`, [org, ws, `protected-${suffix}`, owner])).rows[0].id;

    // Membership RLS intentionally only permits the current user to see/write their own membership.
    // Seed additional roles with each user's own tenant context.
    await context(admin, viewer, org);
    await admin.query(`INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'VIEWER')`, [org, viewer]);
    await context(admin, client, org);
    await admin.query(`INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'CLIENT')`, [org, client]);
    await admin.query('COMMIT');

    // Anonymous / missing application identity: no tenant data may be visible.
    await runtime.query('BEGIN');
    const anonymous = await runtime.query('SELECT id FROM projects WHERE id=$1', [project]);
    assert.equal(anonymous.rowCount, 0, 'missing app identity must not read tenant project');
    await runtime.query('ROLLBACK');

    // A user who is not a member of the selected org must see nothing.
    await runtime.query('BEGIN');
    await context(runtime, outsider, org);
    const outsiderRead = await runtime.query('SELECT id FROM projects WHERE id=$1', [project]);
    assert.equal(outsiderRead.rowCount, 0, 'non-member must not read tenant project');
    const outsiderUpdate = await runtime.query(`UPDATE projects SET name='blocked-outsider' WHERE id=$1 RETURNING id`, [project]);
    assert.equal(outsiderUpdate.rowCount, 0, 'non-member must not update tenant project');
    await runtime.query('ROLLBACK');

    // Current M0 schema proves tenant membership isolation, but does not yet encode role-based write rules.
    // Detect this explicitly rather than claiming VIEWER/CLIENT authorization is implemented.
    await runtime.query('BEGIN');
    await context(runtime, viewer, org);
    const viewerRead = await runtime.query('SELECT id FROM projects WHERE id=$1', [project]);
    assert.equal(viewerRead.rowCount, 1, 'viewer membership should allow tenant read at M0');
    const viewerUpdate = await runtime.query(`UPDATE projects SET name='viewer-write-probe' WHERE id=$1 RETURNING id`, [project]);
    await runtime.query('ROLLBACK');

    await runtime.query('BEGIN');
    await context(runtime, client, org);
    const clientRead = await runtime.query('SELECT id FROM projects WHERE id=$1', [project]);
    assert.equal(clientRead.rowCount, 1, 'client membership should allow tenant read at M0');
    const clientUpdate = await runtime.query(`UPDATE projects SET name='client-write-probe' WHERE id=$1 RETURNING id`, [project]);
    await runtime.query('ROLLBACK');

    console.log('authorization negative: PASS (anonymous + non-member denied)');
    if ((viewerUpdate.rowCount ?? 0) > 0 || (clientUpdate.rowCount ?? 0) > 0) {
      console.log(`authorization RBAC gap: CONFIRMED (viewer_update=${viewerUpdate.rowCount}, client_update=${clientUpdate.rowCount})`);
      console.log('M0 AUTHZ GATE: BLOCKED until role-based mutation policies are implemented');
      process.exitCode = 2;
    } else {
      console.log('authorization RBAC: PASS (viewer/client mutation denied)');
    }
  } finally {
    try { await admin.query('ROLLBACK'); } catch {}
    try { await runtime.query('ROLLBACK'); } catch {}
    admin.release();
    runtime.release();
    await adminPool.end();
    await runtimePool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
