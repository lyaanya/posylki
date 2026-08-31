import { createSupabaseBrowserClient } from "./supabase-client";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3000";

/** Формы совпадают с camelCase-ответом /chats (apps/api/src/chat). */
export interface ChatParticipant {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  verified: boolean;
  rating: number;
}

export type MessageKind = "text" | "photo" | "system";

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string | null;
  kind: MessageKind;
  body: string | null;
  attachmentUrls: string[];
  createdAt: string;
}

export interface ChatSummary {
  id: string;
  listingId: string;
  counterpart: ChatParticipant;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  isBlockedByMe: boolean;
  updatedAt: string;
}

export interface MessagesPage {
  items: ChatMessage[];
  nextCursor: string | null;
}

export class ChatApiError extends Error {
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
  // Формат ошибок API — { error: { code, message, details } } (all-exceptions.filter.ts).
  const body = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string };
  } | null;
  throw new ChatApiError(
    body?.error?.code ?? "UNKNOWN",
    body?.error?.message ?? `API ответил ${response.status}`,
  );
}

export async function fetchMyChats(): Promise<ChatSummary[]> {
  const response = await fetch(`${API_URL}/chats/mine`, { headers: await authHeader() });
  if (!response.ok) return [];
  return (await response.json()) as ChatSummary[];
}

export async function fetchUnreadCount(): Promise<number> {
  const response = await fetch(`${API_URL}/chats/unread-count`, { headers: await authHeader() });
  if (!response.ok) return 0;
  const data = (await response.json()) as { count: number };
  return data.count;
}

export async function fetchMessages(chatId: string, cursor?: string): Promise<MessagesPage> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const response = await fetch(`${API_URL}/chats/${chatId}/messages${qs}`, {
    headers: await authHeader(),
  });
  if (!response.ok) await parseErrorOrThrow(response);
  const data = (await response.json()) as { items: ChatMessage[]; next_cursor: string | null };
  return { items: data.items, nextCursor: data.next_cursor };
}

export interface SendMessageInput {
  body?: string | undefined;
  attachmentPaths?: string[] | undefined;
}

export async function sendMessageToChat(chatId: string, input: SendMessageInput): Promise<ChatMessage> {
  const response = await fetch(`${API_URL}/chats/${chatId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(input),
  });
  if (!response.ok) await parseErrorOrThrow(response);
  return (await response.json()) as ChatMessage;
}

/** Первое сообщение по объявлению — создаёт чат неявно (ТЗ п.9.4). */
export async function sendMessageToListing(
  listingId: string,
  input: SendMessageInput,
): Promise<ChatMessage> {
  const response = await fetch(`${API_URL}/listings/${listingId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(input),
  });
  if (!response.ok) await parseErrorOrThrow(response);
  return (await response.json()) as ChatMessage;
}

export async function markChatRead(chatId: string): Promise<void> {
  await fetch(`${API_URL}/chats/${chatId}/read`, { method: "POST", headers: await authHeader() });
}

export async function blockChatCounterpart(chatId: string): Promise<void> {
  const response = await fetch(`${API_URL}/chats/${chatId}/block`, {
    method: "POST",
    headers: await authHeader(),
  });
  if (!response.ok) await parseErrorOrThrow(response);
}

export async function unblockChatCounterpart(chatId: string): Promise<void> {
  const response = await fetch(`${API_URL}/chats/${chatId}/unblock`, {
    method: "POST",
    headers: await authHeader(),
  });
  if (!response.ok) await parseErrorOrThrow(response);
}

export async function uploadChatAttachment(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_URL}/chats/attachments`, {
    method: "POST",
    headers: await authHeader(),
    body: formData,
  });
  if (!response.ok) await parseErrorOrThrow(response);
  const data = (await response.json()) as { path: string };
  return data.path;
}

/** Уже существующий чат по этому объявлению у текущего пользователя, если есть. */
export async function findChatByListing(listingId: string): Promise<ChatSummary | null> {
  const chats = await fetchMyChats();
  return chats.find((c) => c.listingId === listingId) ?? null;
}
