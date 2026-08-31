import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppException } from "../common/app-exception.js";
import { AuthGuard } from "./auth.guard.js";
import type { IUsersRepository } from "./users.repository.js";
import type { SupabaseJwtService } from "./supabase-jwt.service.js";

function makeContext(headers: Record<string, string>) {
  const request: Record<string, unknown> = { headers };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;

  return { context, request };
}

describe("AuthGuard", () => {
  let jwtService: Pick<SupabaseJwtService, "verify">;
  let usersRepository: IUsersRepository;
  let reflector: Reflector;

  beforeEach(() => {
    jwtService = { verify: vi.fn() };
    usersRepository = {
      findById: vi.fn(),
      setBlocked: vi.fn(),
      softDelete: vi.fn(),
      isDocumentHashBanned: vi.fn(),
      approveVerification: vi.fn(),
      rejectVerification: vi.fn(),
    };
    reflector = new Reflector();
  });

  function makeGuard(isPublic: boolean) {
    vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(isPublic);
    return new AuthGuard(
      reflector,
      jwtService as SupabaseJwtService,
      usersRepository,
    );
  }

  it("пропускает публичный маршрут без токена", async () => {
    const guard = makeGuard(true);
    const { context } = makeContext({});

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("отклоняет закрытый маршрут без токена кодом AUTH_REQUIRED", async () => {
    const guard = makeGuard(false);
    const { context } = makeContext({});

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
    } satisfies Partial<AppException>);
  });

  it("отклоняет невалидный токен кодом AUTH_REQUIRED, не 500-й ошибкой", async () => {
    vi.mocked(jwtService.verify).mockRejectedValue(new Error("bad signature"));
    const guard = makeGuard(false);
    const { context } = makeContext({ authorization: "Bearer garbage" });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
    });
  });

  it("пропускает валидный токен активного пользователя и заполняет authUser", async () => {
    vi.mocked(jwtService.verify).mockResolvedValue({ userId: "user-1", sessionId: "sess-1" });
    vi.mocked(usersRepository.findById).mockResolvedValue({
      id: "user-1",
      email: "a@example.com",
      verificationStatus: "approved",
      isBlocked: false,
      blockedReason: null,
      deletedAt: null,
      emailConfirmed: true,
    });
    const guard = makeGuard(false);
    const { context, request } = makeContext({ authorization: "Bearer valid" });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request["authUser"]).toMatchObject({ id: "user-1" });
    expect(request["authSessionId"]).toBe("sess-1");
  });

  it("отклоняет заблокированного пользователя кодом ACCOUNT_BLOCKED с причиной, даже если токен валиден", async () => {
    vi.mocked(jwtService.verify).mockResolvedValue({ userId: "user-1", sessionId: null });
    vi.mocked(usersRepository.findById).mockResolvedValue({
      id: "user-1",
      email: "a@example.com",
      verificationStatus: "approved",
      isBlocked: true,
      blockedReason: "Мошенничество",
      deletedAt: null,
      emailConfirmed: true,
    });
    const guard = makeGuard(false);
    const { context } = makeContext({ authorization: "Bearer valid" });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: "ACCOUNT_BLOCKED",
      message: "Мошенничество",
    });
  });
});
