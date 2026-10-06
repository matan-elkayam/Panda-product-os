export type OrganizationRole = "OWNER" | "ADMIN" | "MEMBER" | "CLIENT" | "VIEWER";
export type Action = "read" | "create" | "update" | "delete" | "manage_members" | "override_gate" | "deploy";

const policy: Record<OrganizationRole, ReadonlySet<Action>> = {
  OWNER: new Set(["read", "create", "update", "delete", "manage_members", "override_gate", "deploy"]),
  ADMIN: new Set(["read", "create", "update", "delete", "manage_members", "deploy"]),
  MEMBER: new Set(["read", "create", "update"]),
  CLIENT: new Set(["read"]),
  VIEWER: new Set(["read"]),
};

export function can(role: OrganizationRole, action: Action): boolean {
  return policy[role].has(action);
}

export function assertCan(role: OrganizationRole, action: Action): void {
  if (!can(role, action)) throw new Error(`FORBIDDEN:${role}:${action}`);
}
