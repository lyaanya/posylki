import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { Env } from "../config/env.js";

export interface SupabaseAccessTokenClaims {
  userId: string;
  /**
   * Идентификатор сессии Supabase Auth (claim "session_id"), которым
   * связывается наш user_sessions с конкретной сессией на его стороне.
   * Отсутствует у очень старых токенов — тогда сессии не журналируются.
   */
  sessionId: string | null;
}

/**
 * Проверка access-токена Supabase Auth через JWKS проекта — работает и для
 * старых HS256-проектов, и для новых ES256, без хранения отдельного секрета
 * в .env (E03 п. 3.10: уровни доступа проверяются на бэкенде).
 */
@Injectable()
export class SupabaseJwtService {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    const supabaseUrl = config.get("SUPABASE_URL", { infer: true });
    this.jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
  }

  async verify(accessToken: string): Promise<SupabaseAccessTokenClaims> {
    const { payload } = await jwtVerify(accessToken, this.jwks);
    return toClaims(payload);
  }
}

function toClaims(payload: JWTPayload): SupabaseAccessTokenClaims {
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("Токен Supabase Auth без sub-claim");
  }

  const sessionId = typeof payload["session_id"] === "string" ? payload["session_id"] : null;

  return { userId: payload.sub, sessionId };
}
