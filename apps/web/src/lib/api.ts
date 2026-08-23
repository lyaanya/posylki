/**
 * Базовый клиент для REST API (apps/api). Справочники (E05) — единственное,
 * что сейчас читается отсюда; остальной интерфейс всё ещё на моковых данных
 * из lib/mock-data.ts до соответствующих эпиков (E07 и далее).
 */
const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3000";

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);

  if (!response.ok) {
    throw new Error(`API ${path} ответил ${response.status}`);
  }

  return (await response.json()) as T;
}
