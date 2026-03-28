import { api } from "@/lib/api";

export type AgentTaskType = "one_off" | "cron" | "event_driven";

export type EventConfig = {
  event: string;
  filters?: Record<string, unknown>;
};

export type AgentTask = {
  id: string;
  task_type: AgentTaskType;
  name: string;
  system_prompt: string;
  cron_expression: string | null;
  scheduled_at: string | null;
  event_config: EventConfig | null;
  permission_level: string;
  enabled: boolean;
  has_telegram_session: boolean;
  can_edit_permission: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateAgentTaskInput = {
  task_type: AgentTaskType;
  name: string;
  system_prompt: string;
  cron_expression?: string;
  scheduled_at?: string;
  event_config?: EventConfig;
  permission_level?: string;
};

export type AgentTaskUpdate = {
  id: string;
  role: "assistant" | "tool";
  content: string | null;
  tool_calls: Record<string, unknown> | null;
  tool_call_id: string | null;
  created_at: string;
};

export type AgentTaskDetail = AgentTask & {
  updates: AgentTaskUpdate[];
};

export type AgentTaskPage = {
  items: AgentTask[];
  total: number;
};

export function listAgentTasks(opts?: {
  limit?: number;
  offset?: number;
}): Promise<AgentTaskPage> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  const qs = params.toString();
  return api<AgentTaskPage>(`/api/agent-tasks${qs ? `?${qs}` : ""}`);
}

export function createAgentTask(
  input: CreateAgentTaskInput,
): Promise<AgentTask> {
  return api<AgentTask>("/api/agent-tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getAgentTask(id: string): Promise<AgentTaskDetail> {
  return api<AgentTaskDetail>(`/api/agent-tasks/${id}`);
}

export function updateAgentTask(
  id: string,
  input: Partial<CreateAgentTaskInput>,
): Promise<AgentTask> {
  return api<AgentTask>(`/api/agent-tasks/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteAgentTask(id: string): Promise<void> {
  return api<void>(`/api/agent-tasks/${id}`, { method: "DELETE" });
}

export function enableAgentTask(id: string): Promise<AgentTask> {
  return api<AgentTask>(`/api/agent-tasks/${id}/enable`, { method: "POST" });
}

export function disableAgentTask(id: string): Promise<AgentTask> {
  return api<AgentTask>(`/api/agent-tasks/${id}/disable`, { method: "POST" });
}

// --- Agent Telegram auth ---

export function agentAuthSendCode(
  agentTaskId: string,
  phone: string,
): Promise<{ phone_code_hash: string }> {
  return api<{ phone_code_hash: string }>("/api/agent-tasks/auth/send-code", {
    method: "POST",
    body: JSON.stringify({ agent_task_id: agentTaskId, phone }),
  });
}

export function agentAuthVerifyCode(
  agentTaskId: string,
  phone: string,
  code: string,
  phoneCodeHash: string,
): Promise<{ success: boolean; needs_2fa: boolean }> {
  return api<{ success: boolean; needs_2fa: boolean }>(
    "/api/agent-tasks/auth/verify-code",
    {
      method: "POST",
      body: JSON.stringify({
        agent_task_id: agentTaskId,
        phone,
        code,
        phone_code_hash: phoneCodeHash,
      }),
    },
  );
}

export function agentAuthVerify2FA(
  agentTaskId: string,
  phone: string,
  password: string,
): Promise<{ success: boolean }> {
  return api<{ success: boolean }>("/api/agent-tasks/auth/verify-2fa", {
    method: "POST",
    body: JSON.stringify({ agent_task_id: agentTaskId, phone, password }),
  });
}
