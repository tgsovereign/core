import { api } from "@/lib/api";

export type Conversation = {
  id: string;
  title: string;
  permission_level: string;
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
