/** Базовый клиент для публичных GET-эндпоинтов REST API (apps/api). */
const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3000";

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);

  if (!response.ok) {
    throw new Error(`API ${path} ответил ${response.status}`);
  }

  return (await response.json()) as T;
}
