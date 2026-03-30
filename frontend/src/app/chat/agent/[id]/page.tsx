"use client";

import { useState, useRef, useEffect, useCallback, use } from "react";
import { Bot, Loader2 } from "lucide-react";
import ChatMessage, { Message, ToolCall } from "@/components/ChatMessage";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  type AgentTaskDetail,
  type AgentTaskUpdate,
  getAgentTask,
  updateAgentTask,
} from "@/lib/agent-tasks";
import { useSocket, WsMessage } from "@/hooks/useSocket";

function updatesToMessages(updates: AgentTaskUpdate[]): Message[] {
  const messages: Message[] = [];

  for (const u of updates) {
    if (u.role === "assistant") {
      if (u.tool_calls && !u.content) {
        // Tool call message — attach to existing or create new
        const tools: ToolCall[] =
          Object.entries(u.tool_calls).length > 0
            ? [
                {
                  tool:
                    ((u.tool_calls as Record<string, unknown>).name as string) ??
                    "tool",
                  arguments:
                    ((u.tool_calls as Record<string, unknown>).arguments as Record<
                      string,
                      unknown
                    >) ?? {},
                  status: "done" as const,
                },
              ]
            : [];
        if (Array.isArray(u.tool_calls)) {
          tools.length = 0;
          for (const tc of u.tool_calls as unknown[]) {
            const call = tc as {
              function?: { name?: string; arguments?: string };
            };
            tools.push({
              tool: call.function?.name ?? "unknown",
              arguments: JSON.parse(call.function?.arguments ?? "{}"),
              status: "done" as const,
            });
          }
        }
        const last = messages[messages.length - 1];
        if (last && last.role === "assistant") {
          last.tools = [...(last.tools ?? []), ...tools];
        } else {
          messages.push({ id: u.id, role: "assistant", content: "", tools });
        }
      } else if (u.content) {
        const last = messages[messages.length - 1];
        if (last && last.role === "assistant" && !last.content && last.tools) {
          last.content = u.content;
          last.id = u.id;
        } else {
          messages.push({ id: u.id, role: "assistant", content: u.content });
        }
      }
    }
    // Skip "tool" role updates — they're internal
  }

  return messages;
}

export default function AgentChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [task, setTask] = useState<AgentTaskDetail | null>(null);
  const [liveMessages, setLiveMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { addListener } = useSocket();

  useEffect(() => {
    setLoading(true);
    setLiveMessages([]);
    getAgentTask(id)
      .then(setTask)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  // Handle real-time WS messages for this agent task
  const handleWs = useCallback(
    (msg: WsMessage) => {
      if (!("agent_task_id" in msg)) return;
      if (msg.agent_task_id !== id) return;

      if (msg.type === "agent_tool_execution") {
        const tc: ToolCall = {
          tool: msg.tool,
          arguments: msg.arguments,
          status: msg.status,
        };

        setLiveMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant") {
            const tools = [...(last.tools ?? [])];
            const existing = tools.findIndex(
              (t) =>
                t.tool === tc.tool &&
                JSON.stringify(t.arguments) === JSON.stringify(tc.arguments),
            );
            if (existing >= 0) {
              tools[existing] = tc;
            } else {
              tools.push(tc);
            }
            return [...prev.slice(0, -1), { ...last, tools }];
          }
          return [
            ...prev,
            {
              id: msg.agent_task_id,
              role: "assistant" as const,
              content: "",
              tools: [tc],
            },
          ];
        });
      }

      if (msg.type === "agent_response" && msg.done) {
        setLiveMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant") {
            return [...prev.slice(0, -1), { ...last, content: msg.content }];
          }
          return [
            ...prev,
            {
              id: msg.agent_task_id,
              role: "assistant" as const,
              content: msg.content,
            },
          ];
        });
      }
    },
    [id],
  );

  useEffect(() => addListener(handleWs), [addListener, handleWs]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [task, liveMessages]);

  async function handleEditSystemPrompt(newContent: string) {
    if (!task) return;
    try {
      const updated = await updateAgentTask(task.id, {
        system_prompt: newContent,
      });
      setTask((prev) =>
        prev ? { ...prev, system_prompt: updated.system_prompt } : prev,
      );
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!task) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Agent not found</p>
      </main>
    );
  }

  const isEditable =
    task.task_type === "cron" || task.task_type === "event_driven";
  const historicMessages = updatesToMessages(task.updates);
  const allMessages = [...historicMessages, ...liveMessages];

  return (
    <>
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {/* System prompt as "user" message */}
          <ChatMessage
            message={{
              id: "system-prompt",
              role: "user",
              content: task.system_prompt,
            }}
            editable={isEditable}
            onEdit={handleEditSystemPrompt}
          />

          {/* Agent updates rendered as assistant messages */}
          {allMessages.length === 0 && (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Bot />
                </EmptyMedia>
                <EmptyTitle>No updates yet</EmptyTitle>
                <EmptyDescription>
                  This agent will post execution updates here when it runs.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {allMessages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          <div ref={bottomRef} />
        </div>
      </main>
    </>
  );
}
