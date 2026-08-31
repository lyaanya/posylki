import type { ExecutionContext } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AdminGuard } from "./admin.guard.js";
import type { AdminRequest } from "./admin-request.js";
import type { IAdminSessionsRepository } from "./admin-sessions.repository.js";
import type { IAdminUserRepository } from "./admin-user.repository.js";

function makeContext(request: Partial<AdminRequest>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function makeSessions(overrides: Partial<IAdminSessionsRepository> = {}): IAdminSessionsRepository {
  return {
    create: vi.fn(),
    findBySupabaseSessionId: vi.fn().mockResolvedValue(null),
    touch: vi.fn(),
    revoke: vi.fn(),
    ...overrides,
  };
}

const AUTH_USER = {
  id: "u1",
  email: "a@example.com",
  verificationStatus: "approved" as const,
  isBlocked: false,
  blockedReason: null,
  deletedAt: null,
  emailConfirmed: true,
};

describe("AdminGuard", () => {
  it("отклоняет запрос без authUser (AuthGuard должен был выполниться раньше)", async () => {
    const adminUsers: IAdminUserRepository = { findById: vi.fn(), findAllActive: vi.fn(), setTotpSecret: vi.fn() };
    const guard = new AdminGuard(adminUsers, makeSessions());

    await expect(guard.canActivate(makeContext({}))).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
    });
  });

  it("отклоняет обычного пользователя, у которого нет записи в admin_users", async () => {
    const adminUsers: IAdminUserRepository = {
      findById: vi.fn().mockResolvedValue(null),
      findAllActive: vi.fn(),
      setTotpSecret: vi.fn(),
    };
    const guard = new AdminGuard(adminUsers, makeSessions());
    const request: Partial<AdminRequest> = { authUser: AUTH_USER, authSessionId: "sess-1" };

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
        totpSecret: "SECRET",
      }),
      findAllActive: vi.fn(),
      setTotpSecret: vi.fn(),
    };
    const guard = new AdminGuard(adminUsers, makeSessions());
    const request: Partial<AdminRequest> = { authUser: AUTH_USER, authSessionId: "sess-1" };

    await expect(guard.canActivate(makeContext(request))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("отклоняет активного сотрудника без прохождения второго фактора (нет admin_sessions)", async () => {
    const admin = { id: "u1", email: "a@example.com", fullName: "A", role: "admin" as const, isActive: true, totpSecret: "SECRET" };
    const adminUsers: IAdminUserRepository = { findById: vi.fn().mockResolvedValue(admin), findAllActive: vi.fn(), setTotpSecret: vi.fn() };
    const guard = new AdminGuard(adminUsers, makeSessions({ findBySupabaseSessionId: vi.fn().mockResolvedValue(null) }));
    const request: Partial<AdminRequest> = { authUser: AUTH_USER, authSessionId: "sess-1" };

    await expect(guard.canActivate(makeContext(request))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("отклоняет сессию, простаивавшую больше 12 часов, и отзывает её", async () => {
    const admin = { id: "u1", email: "a@example.com", fullName: "A", role: "admin" as const, isActive: true, totpSecret: "SECRET" };
    const staleSession = { id: "s1", adminId: "u1", supabaseSessionId: "sess-1", lastActiveAt: new Date(Date.now() - 13 * 60 * 60 * 1000) };
    const revoke = vi.fn();
    const adminUsers: IAdminUserRepository = { findById: vi.fn().mockResolvedValue(admin), findAllActive: vi.fn(), setTotpSecret: vi.fn() };
    const guard = new AdminGuard(adminUsers, makeSessions({ findBySupabaseSessionId: vi.fn().mockResolvedValue(staleSession), revoke }));
    const request: Partial<AdminRequest> = { authUser: AUTH_USER, authSessionId: "sess-1" };

    await expect(guard.canActivate(makeContext(request))).rejects.toMatchObject({
      code: "ADMIN_SESSION_EXPIRED",
    });
    expect(revoke).toHaveBeenCalledWith("sess-1");
  });

  it("пропускает активного сотрудника с действующей 2FA-сессией, продлевает её и заполняет adminUser", async () => {
    const admin = { id: "u1", email: "a@example.com", fullName: "A", role: "admin" as const, isActive: true, totpSecret: "SECRET" };
    const freshSession = { id: "s1", adminId: "u1", supabaseSessionId: "sess-1", lastActiveAt: new Date() };
    const touch = vi.fn();
    const adminUsers: IAdminUserRepository = { findById: vi.fn().mockResolvedValue(admin), findAllActive: vi.fn(), setTotpSecret: vi.fn() };
    const guard = new AdminGuard(adminUsers, makeSessions({ findBySupabaseSessionId: vi.fn().mockResolvedValue(freshSession), touch }));
    const request: Partial<AdminRequest> = { authUser: AUTH_USER, authSessionId: "sess-1" };

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(request.adminUser).toEqual(admin);
    expect(touch).toHaveBeenCalledWith("s1");
  });
});
