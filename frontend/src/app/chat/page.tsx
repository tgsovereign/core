"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import ChatMessage, { Message, ToolCall } from "@/components/ChatMessage";
import { createConversation } from "@/lib/conversations";
import { useSocket, WsMessage } from "@/hooks/useSocket";
import { usePermission } from "./layout";

export default function NewChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "greeting",
      role: "assistant",
      content: "Hello! I'm your Sovereign assistant. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const { send, addListener } = useSocket();
  const { permissionLevel } = usePermission();

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
            if (existing >= 0) tools[existing] = tc;
            else tools.push(tc);
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

        // Navigate to the real conversation URL now that we have a response
        if (conversationIdRef.current) {
          router.replace(`/chat/${conversationIdRef.current}`);
        }
      }
    },
    [router],
  );

  useEffect(() => addListener(handleWs), [addListener, handleWs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || busy) return;

    setBusy(true);
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: text },
    ]);
    setInput("");

    try {
      const conv = await createConversation(permissionLevel);
      conversationIdRef.current = conv.id;

      const requestId = crypto.randomUUID();
      pendingRef.current = requestId;

      send({
        type: "agent_invoke",
        request_id: requestId,
        prompt: text,
        conversation_id: conv.id,
      });
    } catch {
      setBusy(false);
    }
  }

  return (
    <>
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 max-sm:pb-22">
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

      <Separator className="max-sm:hidden" />
      <footer className="px-3 py-3.5 sm:px-6 max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:z-30 max-sm:p-3">
        <form
          className="mx-auto flex max-w-3xl gap-2 max-sm:gap-1 liquid-glass max-sm:pl-1.5 max-sm:pr-3 max-sm:py-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 max-sm:border-0 max-sm:bg-transparent max-sm:rounded-full max-sm:h-11 max-sm:px-3 max-sm:focus-visible:ring-0 max-sm:focus-visible:border-0"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || busy}
            className="max-sm:bg-transparent max-sm:shadow-none max-sm:hover:bg-transparent max-sm:text-violet-400 max-sm:h-11 max-sm:w-11 max-sm:rounded-full"
          >
            <Send className="h-4 w-4 max-sm:fill-current" />
          </Button>
        </form>
      </footer>
    </>
  );
}
