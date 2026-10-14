import { describe, expect, it } from "vitest";
import { canViewHealthNotes, resolveAdminAccess, safeAdminRedirect } from "@/lib/auth/access";

const claims = { sub: "user-1", email: "office@example.com" };

describe("resolveAdminAccess", () => {
  it("treats a missing session as signed out", () => {
    expect(resolveAdminAccess(null, null)).toEqual({ status: "signed_out" });
    expect(resolveAdminAccess({ sub: "" }, null)).toEqual({ status: "signed_out" });
  });

  it("does not grant access just for being signed in", () => {
    expect(resolveAdminAccess(claims, null)).toEqual({ status: "not_authorized", email: "office@example.com" });
  });

  it("rejects inactive or unknown roles", () => {
    expect(resolveAdminAccess(claims, { full_name: "A", role: "admin", is_active: false }).status).toBe("not_authorized");
    expect(resolveAdminAccess(claims, { full_name: "A", role: "owner", is_active: true }).status).toBe("not_authorized");
  });

  it("authorizes active staff and admins", () => {
    const staff = resolveAdminAccess(claims, { full_name: "Office", role: "staff", is_active: true });
    expect(staff).toEqual({
      status: "authorized",
      admin: { userId: "user-1", email: "office@example.com", fullName: "Office", role: "staff" },
    });
    if (staff.status === "authorized") expect(canViewHealthNotes(staff.admin)).toBe(false);

    const admin = resolveAdminAccess(claims, { full_name: "Director", role: "admin", is_active: true });
    if (admin.status === "authorized") expect(canViewHealthNotes(admin.admin)).toBe(true);
  });
});

describe("safeAdminRedirect", () => {
  it("only allows paths inside the admin area", () => {
    expect(safeAdminRedirect("/admin/students?page=2")).toBe("/admin/students?page=2");
    expect(safeAdminRedirect("https://evil.example")).toBe("/admin");
    expect(safeAdminRedirect("//evil.example/admin")).toBe("/admin");
    expect(safeAdminRedirect("/register")).toBe("/admin");
    expect(safeAdminRedirect("/admin/login")).toBe("/admin");
    expect(safeAdminRedirect(undefined)).toBe("/admin");
  });
});
