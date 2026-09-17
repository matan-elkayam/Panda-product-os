# M0 Auth & RBAC Contract

## Authentication
Auth.js owns web sessions. Authentication and authorization are separate concerns.

M0 required flows:
1. Sign in
2. Sign out
3. Protected application shell
4. Session expiry
5. Password reset/recovery provider flow before production

## Authorization
Roles: OWNER, ADMIN, MEMBER, CLIENT, VIEWER.

- OWNER: organization control, members, projects, gates.
- ADMIN: operational administration; cannot transfer ownership.
- MEMBER: normal project work.
- CLIENT: explicitly shared client-facing project resources only.
- VIEWER: read-only resources explicitly granted.

Every protected request must resolve: user → organization membership → project permission → action.

## Database isolation
A transaction sets `app.user_id` and `app.org_id`; PostgreSQL RLS evaluates tenant access. Never trust organization IDs supplied by the browser without membership resolution.

## Mandatory negative tests
- Org A cannot read Org B.
- Org A cannot write Org B.
- CLIENT cannot read internal-only resources.
- VIEWER cannot mutate.
- Anonymous cannot access protected data.

M0 Gate cannot pass until these tests execute against a real PostgreSQL instance.
