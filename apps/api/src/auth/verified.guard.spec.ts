import type { ExecutionContext } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { VerifiedGuard } from "./verified.guard.js";
import type { AuthUser } from "./users.repository.js";

function makeContext(authUser: AuthUser | undefined) {
  const request = { authUser };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("VerifiedGuard", () => {
  const guard = new VerifiedGuard();

  it("пропускает верифицированного пользователя", () => {
    const context = makeContext({
      id: "u1",
      email: "a@example.com",
      verificationStatus: "approved",
      isBlocked: false,
      blockedReason: null,
      deletedAt: null,
      emailConfirmed: true,
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it("отклоняет неверифицированного пользователя кодом VERIFICATION_REQUIRED", () => {
    const context = makeContext({
      id: "u1",
      email: "a@example.com",
      verificationStatus: "pending",
      isBlocked: false,
      blockedReason: null,
      deletedAt: null,
      emailConfirmed: true,
    });

    expect(() => guard.canActivate(context)).toThrowError(
      expect.objectContaining({ code: "VERIFICATION_REQUIRED" }),
    );
  });
});
