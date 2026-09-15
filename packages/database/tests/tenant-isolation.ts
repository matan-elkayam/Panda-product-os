import assert from 'node:assert/strict';
import { Pool, type PoolClient } from 'pg';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: url });

async function context(client: PoolClient, userId: string, orgId: string) {
  await client.query(`SELECT set_config('app.user_id', $1, true), set_config('app.org_id', $2, true)`, [userId, orgId]);
}

async function main() {
  const admin = await pool.connect();
  const runtime = await pool.connect();
  try {
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
    await runtime.query('SET LOCAL ROLE panda_runtime');
    await context(runtime, a, orgA);
    const visible = await runtime.query('SELECT organization_id FROM projects ORDER BY organization_id');
    assert.equal(visible.rowCount, 1, 'Org A must see exactly one project');
    assert.equal(visible.rows[0].organization_id, orgA, 'Org A must only see its own project');
    const foreign = await runtime.query('SELECT 1 FROM projects WHERE organization_id=$1', [orgB]);
    assert.equal(foreign.rowCount, 0, 'cross-org read must be denied');
    const mutation = await runtime.query(`UPDATE projects SET name='blocked' WHERE organization_id=$1 RETURNING id`, [orgB]);
    assert.equal(mutation.rowCount, 0, 'cross-org mutation must be denied');
    await runtime.query('ROLLBACK');
    console.log('tenant isolation: PASS');
  } finally {
    admin.release();
    runtime.release();
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
