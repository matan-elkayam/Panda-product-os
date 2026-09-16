import assert from 'node:assert/strict';
import { Pool, type PoolClient } from 'pg';

const runtimeUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!runtimeUrl) throw new Error('DATABASE_URL is required');
if (!migrationUrl) throw new Error('MIGRATION_DATABASE_URL is required');

const adminPool = new Pool({ connectionString: migrationUrl, max: 1 });
const runtimePool = new Pool({ connectionString: runtimeUrl, max: 1 });

async function context(client: PoolClient, userId: string, orgId: string) {
  await client.query(`SELECT set_config('app.user_id', $1, true), set_config('app.org_id', $2, true)`, [userId, orgId]);
}

async function main() {
  const admin = await adminPool.connect();
  const runtime = await runtimePool.connect();
  try {
    const identity = await runtime.query<{ current_user: string; session_user: string }>('SELECT current_user, session_user');
    const runtimeIdentity = identity.rows[0];
    assert.ok(runtimeIdentity, 'runtime identity must be available');
    if (process.env.MIGRATION_DATABASE_URL) {
      assert.equal(runtimeIdentity.current_user, 'panda_app', 'staging runtime must connect as panda_app');
      assert.equal(runtimeIdentity.session_user, 'panda_app', 'staging session must connect as panda_app');
    }

    const suffix = Date.now().toString();
    const a = (await admin.query(`INSERT INTO users(email, name) VALUES ($1,'A') RETURNING id`, [`a-${suffix}@test.local`])).rows[0].id;
    const b = (await admin.query(`INSERT INTO users(email, name) VALUES ($1,'B') RETURNING id`, [`b-${suffix}@test.local`])).rows[0].id;
    const orgA = (await admin.query(`INSERT INTO organizations(name, slug) VALUES ('Org A',$1) RETURNING id`, [`org-a-${suffix}`])).rows[0].id;
    const orgB = (await admin.query(`INSERT INTO organizations(name, slug) VALUES ('Org B',$1) RETURNING id`, [`org-b-${suffix}`])).rows[0].id;
    await admin.query(`INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'OWNER'),($3,$4,'OWNER')`, [orgA,a,orgB,b]);
    const wsA = (await admin.query(`INSERT INTO workspaces(organization_id,name,slug) VALUES ($1,'A',$2) RETURNING id`, [orgA,`a-${suffix}`])).rows[0].id;
    const wsB = (await admin.query(`INSERT INTO workspaces(organization_id,name,slug) VALUES ($1,'B',$2) RETURNING id`, [orgB,`b-${suffix}`])).rows[0].id;
    await admin.query(`INSERT INTO projects(organization_id,workspace_id,name,slug,created_by) VALUES ($1,$2,'A',$3,$4),($5,$6,'B',$7,$8)`, [orgA,wsA,`a-${suffix}`,a,orgB,wsB,`b-${suffix}`,b]);

    await runtime.query('BEGIN');
    await context(runtime, a, orgA);
    const visible = await runtime.query('SELECT organization_id FROM projects ORDER BY organization_id');
    assert.equal(visible.rowCount, 1, 'Org A must see exactly one project');
    assert.equal(visible.rows[0].organization_id, orgA, 'Org A must only see its own project');
    const foreign = await runtime.query('SELECT 1 FROM projects WHERE organization_id=$1', [orgB]);
    assert.equal(foreign.rowCount, 0, 'cross-org read must be denied');
    const mutation = await runtime.query(`UPDATE projects SET name='blocked' WHERE organization_id=$1 RETURNING id`, [orgB]);
    assert.equal(mutation.rowCount, 0, 'cross-org mutation must be denied');
    await runtime.query('ROLLBACK');
    console.log(`tenant isolation: PASS (runtime=${runtimeIdentity.current_user})`);
  } finally {
    admin.release();
    runtime.release();
    await adminPool.end();
    await runtimePool.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
