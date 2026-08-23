import { createSupabaseBrowserClient } from "./supabase-client";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3000";

/** Совпадает с ParsedListingText на бэкенде (apps/api/src/ai/scenarios/parse-listing-text.scenario.ts). */
export interface ParsedListingText {
  type: "trip" | "request" | null;
  fromCity: string | null;
  toCity: string | null;
  date: string | null;
  weightKg: number | null;
  pricePerKg: number | null;
  minPrice: number | null;
  undeterminedFields: string[];
}

export type ParseListingTextResult = { ok: true; data: ParsedListingText } | { ok: false };

/**
 * Сценарий 3 (E13 пп. 13.22–13.27): свободный текст → поля формы.
 * Требует вход — та же сессия Supabase Auth, что уже хранится в браузере
 * для остального приложения (см. lib/supabase-client.ts).
 */
export async function parseListingText(text: string): Promise<ParseListingTextResult> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const response = await fetch(`${API_URL}/ai/parse-listing-text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    return { ok: false };
  }

  return (await response.json()) as ParseListingTextResult;
}
