import { api } from "@/lib/api";

export type Conversation = {
  id: string;
  title: string;
  permission_level: string;
  created_at: string;
  updated_at: string;
};

export type ConversationPage = {
  items: Conversation[];
  total: number;
};

export type StoredMessage = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string | null;
  tool_calls: unknown[] | null;
  tool_call_id: string | null;
  created_at: string;
};

export type ConversationDetail = Conversation & {
  messages: StoredMessage[];
};

export function listConversations(opts?: {
  limit?: number;
  offset?: number;
}): Promise<ConversationPage> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  const qs = params.toString();
  return api<ConversationPage>(`/api/conversations${qs ? `?${qs}` : ""}`);
}

export function createConversation(
  permissionLevel: string = "read_only",
): Promise<Conversation> {
  return api<Conversation>("/api/conversations", {
    method: "POST",
    body: JSON.stringify({ permission_level: permissionLevel }),
  });
}

export function getConversation(id: string): Promise<ConversationDetail> {
  return api<ConversationDetail>(`/api/conversations/${id}`);
}

export function deleteConversation(id: string): Promise<void> {
  return api<void>(`/api/conversations/${id}`, { method: "DELETE" });
}
