import { api } from "@/lib/api";

export type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
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

export function listConversations(): Promise<Conversation[]> {
  return api<Conversation[]>("/api/conversations");
}

export function createConversation(): Promise<Conversation> {
  return api<Conversation>("/api/conversations", { method: "POST" });
}

export function getConversation(id: string): Promise<ConversationDetail> {
  return api<ConversationDetail>(`/api/conversations/${id}`);
}

export function deleteConversation(id: string): Promise<void> {
  return api<void>(`/api/conversations/${id}`, { method: "DELETE" });
}
