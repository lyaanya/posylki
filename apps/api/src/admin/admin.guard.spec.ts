import type { ExecutionContext } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AdminGuard } from "./admin.guard.js";
import type { AdminRequest } from "./admin-request.js";
import type { IAdminUserRepository } from "./admin-user.repository.js";

function makeContext(request: Partial<AdminRequest>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("AdminGuard", () => {
  it("отклоняет запрос без authUser (AuthGuard должен был выполниться раньше)", async () => {
    const adminUsers: IAdminUserRepository = { findById: vi.fn() };
    const guard = new AdminGuard(adminUsers);

    await expect(guard.canActivate(makeContext({}))).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
    });
  });

  it("отклоняет обычного пользователя, у которого нет записи в admin_users", async () => {
    const adminUsers: IAdminUserRepository = { findById: vi.fn().mockResolvedValue(null) };
    const guard = new AdminGuard(adminUsers);
    const request: Partial<AdminRequest> = {
      authUser: { id: "u1", email: "a@example.com", verificationStatus: "approved", isBlocked: false, deletedAt: null },
    };

    await expect(guard.canActivate(makeContext(request))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("отклоняет отключённого сотрудника", async () => {
    const adminUsers: IAdminUserRepository = {
      findById: vi.fn().mockResolvedValue({
        id: "u1",
        email: "a@example.com",
        fullName: "A",
        role: "moderator",
        isActive: false,
      }),
    };
    const guard = new AdminGuard(adminUsers);
    const request: Partial<AdminRequest> = {
      authUser: { id: "u1", email: "a@example.com", verificationStatus: "approved", isBlocked: false, deletedAt: null },
    };

    await expect(guard.canActivate(makeContext(request))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("пропускает активного сотрудника и заполняет adminUser", async () => {
    const admin = { id: "u1", email: "a@example.com", fullName: "A", role: "admin" as const, isActive: true };
    const adminUsers: IAdminUserRepository = { findById: vi.fn().mockResolvedValue(admin) };
    const guard = new AdminGuard(adminUsers);
    const request: Partial<AdminRequest> = {
      authUser: { id: "u1", email: "a@example.com", verificationStatus: "approved", isBlocked: false, deletedAt: null },
    };

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(request.adminUser).toEqual(admin);
  });
});
