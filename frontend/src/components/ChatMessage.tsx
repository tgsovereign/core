"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Check, Pencil, User, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToolCall = {
  tool: string;
  arguments: Record<string, unknown>;
  status: "running" | "done";
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  tools?: ToolCall[];
};

function ToolBadge({ tc }: { tc: ToolCall }) {
  const args = Object.entries(tc.arguments)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(", ");

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-2 font-normal text-xs",
        tc.status === "running" && "animate-pulse",
      )}
    >
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          tc.status === "running" ? "bg-yellow-400" : "bg-emerald-400",
        )}
      />
      <span className="font-mono">{tc.tool}</span>
      {args && (
        <span className="max-w-[200px] truncate text-muted-foreground">
          ({args})
        </span>
      )}
    </Badge>
  );
}

function MessageAvatar({ isUser }: { isUser: boolean }) {
  return (
    <div
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
        isUser
          ? "bg-sky-500/15 text-sky-400"
          : "bg-violet-500/15 text-violet-400",
      )}
    >
      {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
    </div>
  );
}

export default function ChatMessage({
  message,
  editable,
  onEdit,
}: {
  message: Message;
  editable?: boolean;
  onEdit?: (newContent: string) => void;
}) {
  const isUser = message.role === "user";
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  function startEdit() {
    setEditValue(message.content);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setEditValue("");
  }

  function saveEdit() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== message.content) {
      onEdit?.(trimmed);
    }
    setEditing(false);
    setEditValue("");
  }

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <MessageAvatar isUser={isUser} />
      <div className={cn("flex flex-col gap-1.5", isUser ? "items-end" : "items-start")}>
        {message.tools && message.tools.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {message.tools.map((tc, i) => (
              <ToolBadge key={i} tc={tc} />
            ))}
          </div>
        )}
        {message.content && !editing && (
          <div className="group relative">
            <div
              className={cn(
                "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                isUser
                  ? "rounded-tr-md bg-sky-600 text-white"
                  : "rounded-tl-md bg-card text-card-foreground border border-border/50 prose prose-sm prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-pre:my-2 prose-pre:bg-muted prose-code:text-muted-foreground prose-a:text-sky-400",
              )}
            >
              {isUser ? message.content : <Markdown>{message.content}</Markdown>}
            </div>
            {editable && (
              <button
                type="button"
                onClick={startEdit}
                className="absolute -top-2 -right-2 hidden h-6 w-6 items-center justify-center rounded-full bg-muted border border-border text-muted-foreground hover:text-foreground group-hover:inline-flex"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
        {editing && (
          <div className="flex w-full max-w-md flex-col gap-2">
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              rows={4}
              autoFocus
              className="text-sm"
            />
            <div className="flex gap-1.5 justify-end">
              <Button size="sm" variant="ghost" onClick={cancelEdit}>
                <X className="mr-1 h-3.5 w-3.5" />
                Cancel
              </Button>
              <Button size="sm" onClick={saveEdit} disabled={!editValue.trim()}>
                <Check className="mr-1 h-3.5 w-3.5" />
                Save
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
