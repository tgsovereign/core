"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Shield, ShieldCheck, ShieldAlert } from "lucide-react";

const LEVELS = [
  {
    value: "read_only",
    label: "Read only",
    desc: "List chats, read & search messages",
    icon: Shield,
    variant: "outline" as const,
  },
  {
    value: "read_write",
    label: "Read & Write",
    desc: "Above + send messages",
    icon: ShieldCheck,
    variant: "secondary" as const,
  },
  {
    value: "full_autonomy",
    label: "Full autonomy",
    desc: "All actions",
    icon: ShieldAlert,
    variant: "destructive" as const,
  },
] as const;

export type Level = (typeof LEVELS)[number]["value"];

export default function PermissionToggle({
  conversationId,
  onLevelChange,
}: {
  conversationId: string | null;
  onLevelChange?: (level: Level) => void;
}) {
  const [level, setLevel] = useState<Level>("read_only");

  // Fetch permission level when conversationId changes
  useEffect(() => {
    if (!conversationId) {
      setLevel("read_only");
      onLevelChange?.("read_only");
      return;
    }

    api<{ permission_level: Level }>(
      `/api/conversations/config?conversation_id=${conversationId}`,
    )
      .then((r) => {
        setLevel(r.permission_level);
        onLevelChange?.(r.permission_level);
      })
      .catch(() => {});
  }, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleChange(newLevel: Level) {
    setLevel(newLevel);
    onLevelChange?.(newLevel);

    // If no conversation yet, just update local state (will be used at creation time)
    if (!conversationId) return;

    try {
      await api("/api/conversations/config", {
        method: "PUT",
        body: JSON.stringify({
          conversation_id: conversationId,
          permission_level: newLevel,
        }),
      });
    } catch {
      // Revert on error
      api<{ permission_level: Level }>(
        `/api/conversations/config?conversation_id=${conversationId}`,
      )
        .then((r) => {
          setLevel(r.permission_level);
          onLevelChange?.(r.permission_level);
        })
        .catch(() => {});
    }
  }

  const current = LEVELS.find((l) => l.value === level)!;
  const Icon = current.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none">
        <Icon className="h-4 w-4" />
        <Badge variant={current.variant} className="text-xs">
          {current.label}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {LEVELS.map((l) => {
          const LIcon = l.icon;
          return (
            <DropdownMenuItem
              key={l.value}
              onClick={() => handleChange(l.value)}
              className="flex flex-col items-start gap-1 py-2"
            >
              <div className="flex items-center gap-2">
                <LIcon className="h-4 w-4" />
                <span className="font-medium">{l.label}</span>
              </div>
              <span className="text-xs text-muted-foreground">{l.desc}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
