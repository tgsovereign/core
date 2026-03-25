"use client";

import { useState, useRef, useEffect, useCallback, use } from "react";
import { Send, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import ChatMessage, { Message, ToolCall } from "@/components/ChatMessage";
import { getConversation, StoredMessage } from "@/lib/conversations";
import { useSocket, WsMessage } from "@/hooks/useSocket";

function storedToMessages(stored: StoredMessage[]): Message[] {
  const messages: Message[] = [];

  for (const m of stored) {
    if (m.role === "user") {
      messages.push({ id: m.id, role: "user", content: m.content ?? "" });
    } else if (m.role === "assistant") {
      // Assistant messages with tool_calls but no content are intermediate — attach tools to next final message
      if (m.tool_calls && m.tool_calls.length > 0 && !m.content) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tools: ToolCall[] = m.tool_calls.map((tc: any) => ({
          tool: (tc as { function?: { name?: string } }).function?.name ?? "unknown",
          arguments: JSON.parse(
            (tc as { function?: { arguments?: string } }).function?.arguments ?? "{}",
          ),
          status: "done" as const,
        }));
        // Find or create the message to attach to
        const last = messages[messages.length - 1];
        if (last && last.role === "assistant") {
          last.tools = [...(last.tools ?? []), ...tools];
        } else {
          messages.push({ id: m.id, role: "assistant", content: "", tools });
        }
      } else if (m.content) {
        // Final assistant response — attach to existing message with tools or create new
        const last = messages[messages.length - 1];
        if (last && last.role === "assistant" && !last.content && last.tools) {
          last.content = m.content;
          last.id = m.id;
        } else {
          messages.push({ id: m.id, role: "assistant", content: m.content });
        }
      }
    }
    // Skip "tool" role messages — they're internal
  }

  return messages;
}

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<string | null>(null);
  const { send, addListener, connected } = useSocket();

  // Load conversation messages
  useEffect(() => {
    setMessages([]);
    setBusy(false);
    pendingRef.current = null;

    getConversation(id)
      .then((conv) => {
        const restored = storedToMessages(conv.messages);
        setMessages(
          restored.length > 0
            ? restored
            : [
                {
                  id: "greeting",
                  role: "assistant",
                  content: "Hello! I'm your Sovereign assistant. How can I help you today?",
                },
              ],
        );
      })
      .catch(() => {});
  }, [id]);

  // Handle incoming WS messages
  const handleWs = useCallback(
    (msg: WsMessage) => {
      if (msg.type === "conversation_title_updated") return;

      const rid = msg.request_id;
      if (rid !== pendingRef.current) return;

      if (msg.type === "agent_tool_execution") {
        const tc: ToolCall = {
          tool: msg.tool,
          arguments: msg.arguments,
          status: msg.status,
        };

        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant" && last.id === rid) {
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
            { id: rid, role: "assistant" as const, content: "", tools: [tc] },
          ];
        });
      }

      if (msg.type === "agent_response" && msg.done) {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant" && last.id === rid) {
            return [...prev.slice(0, -1), { ...last, content: msg.content }];
          }
          return [
            ...prev,
            { id: rid, role: "assistant" as const, content: msg.content },
          ];
        });
        pendingRef.current = null;
        setBusy(false);
      }
    },
    [],
  );

  useEffect(() => addListener(handleWs), [addListener, handleWs]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const text = input.trim();
    if (!text || busy) return;

    const requestId = crypto.randomUUID();
    pendingRef.current = requestId;
    setBusy(true);

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: text },
    ]);
    setInput("");

    send({
      type: "agent_invoke",
      request_id: requestId,
      prompt: text,
      conversation_id: id,
    });
  }

  return (
    <>
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {busy && !messages.find((m) => m.id === pendingRef.current) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking...
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      <Separator />
      <footer className="max-sm:p-0 px-3 py-3 sm:px-6 sm:py-3.5">
        <form
          className="mx-auto flex max-w-3xl gap-2 max-sm:gap-0"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 max-sm:border-0 max-sm:rounded-none max-sm:h-15 max-sm:px-4 max-sm:focus-visible:ring-0 max-sm:focus-visible:border-0"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || busy}
            className="max-sm:bg-transparent max-sm:shadow-none max-sm:hover:bg-transparent max-sm:text-violet-400 max-sm:h-15 max-sm:w-15"
          >
            <Send className="h-4 w-4 max-sm:fill-current" />
          </Button>
        </form>
      </footer>
    </>
  );
}
