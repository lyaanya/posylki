import { apiGet, apiPost } from "./api";

export function fetchTotpStatus(): Promise<{ enrolled: boolean }> {
  return apiGet("/admin/auth/totp/status");
}

export function setupTotp(): Promise<{ secret: string }> {
  return apiPost("/admin/auth/totp/setup");
}

export function verifyTotp(code: string, pendingSecret?: string): Promise<{ ok: true }> {
  return apiPost("/admin/auth/totp/verify", { code, pendingSecret });
}
