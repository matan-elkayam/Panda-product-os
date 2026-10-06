import { describe, expect, it } from "vitest";
import { can } from "./permissions";

describe("Panda RBAC", () => {
  it("prevents viewers from mutating", () => {
    expect(can("VIEWER", "update")).toBe(false);
    expect(can("VIEWER", "delete")).toBe(false);
  });

  it("prevents clients from internal management", () => {
    expect(can("CLIENT", "manage_members")).toBe(false);
    expect(can("CLIENT", "override_gate")).toBe(false);
    expect(can("CLIENT", "deploy")).toBe(false);
  });

  it("reserves gate override for owner", () => {
    expect(can("OWNER", "override_gate")).toBe(true);
    expect(can("ADMIN", "override_gate")).toBe(false);
  });
});
