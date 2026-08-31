import { apiGet } from "./api";
import { createSupabaseBrowserClient } from "./supabase-client";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3000";

export type ReviewRole = "as_courier" | "as_customer";

/** Формы совпадают с camelCase-ответом /reviews (apps/api/src/reviews). */
export interface ReviewAuthor {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  isDeleted: boolean;
}

export interface Review {
  id: string;
  dealId: string;
  author: ReviewAuthor;
  subjectId: string;
  role: ReviewRole;
  rating: number | null;
  text: string | null;
  createdAt: string;
  publishedAt: string | null;
  fromCity: string;
  toCity: string;
}

export interface ReviewsPage {
  items: Review[];
  nextCursor: string | null;
}

export class ReviewApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Нужно войти в аккаунт");
  }
  return { Authorization: `Bearer ${session.access_token}` };
}

async function parseErrorOrThrow(response: Response): Promise<never> {
  const body = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string };
  } | null;
  throw new ReviewApiError(
    body?.error?.code ?? "UNKNOWN",
    body?.error?.message ?? `API ответил ${response.status}`,
  );
}

export async function fetchReviewsForUser(userId: string, limit = 5, cursor?: string): Promise<ReviewsPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  const response = await apiGet<{ items: Review[]; next_cursor: string | null }>(
    `/reviews/user/${userId}?${params.toString()}`,
  );
  return { items: response.items, nextCursor: response.next_cursor };
}

export async function fetchReviewsByDeal(
  dealId: string,
): Promise<{ mine: Review | null; theirs: Review | null }> {
  const response = await fetch(`${API_URL}/reviews/by-deal/${dealId}`, { headers: await authHeader() });
  if (!response.ok) await parseErrorOrThrow(response);
  return (await response.json()) as { mine: Review | null; theirs: Review | null };
}

export async function createReview(input: {
  dealId: string;
  rating: number;
  text?: string | undefined;
}): Promise<Review> {
  const response = await fetch(`${API_URL}/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(input),
  });
  if (!response.ok) await parseErrorOrThrow(response);
  return (await response.json()) as Review;
}
