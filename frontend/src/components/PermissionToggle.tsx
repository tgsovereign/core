"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Shield, ShieldCheck, ShieldAlert, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const LEVELS = [
  {
    value: "read_only",
    label: "Read only",
    desc: "List chats, read & search messages",
    icon: Shield,
    variant: "outline" as const,
    accent: "text-perm-readonly",
    bg: "bg-perm-readonly-bg",
  },
  {
    value: "read_write",
    label: "Read & Write",
    desc: "Above + send messages",
    icon: ShieldCheck,
    variant: "secondary" as const,
    accent: "text-perm-readwrite",
    bg: "bg-perm-readwrite-bg",
  },
  {
    value: "full_autonomy",
    label: "Full autonomy",
    desc: "All Telegram actions, unrestricted",
    icon: ShieldAlert,
    variant: "destructive" as const,
    accent: "text-perm-autonomy",
    bg: "bg-perm-autonomy-bg",
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
      <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none">
        <Icon className="h-4 w-4" />
        <Badge variant={current.variant} className="text-xs">
          {current.label}
        </Badge>
        <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-border/50 px-3.5 py-2.5">
          <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", current.bg)}>
            <Icon className={cn("h-3.5 w-3.5", current.accent)} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Permissions</p>
            <p className="text-[10px] text-muted-foreground">Controls what the agent can do</p>
          </div>
        </div>

        {/* Level options */}
        <div className="px-1.5 py-1.5">
          {LEVELS.map((l) => {
            const LIcon = l.icon;
            const isActive = l.value === level;
            return (
              <button
                key={l.value}
                type="button"
                onClick={() => handleChange(l.value)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-left transition-colors",
                  isActive
                    ? "bg-accent"
                    : "hover:bg-accent/50",
                )}
              >
                <div className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded", l.bg)}>
                  <LIcon className={cn("h-3 w-3", l.accent)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">{l.label}</span>
                    {isActive && (
                      <Check className="h-3 w-3 text-emerald-400" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                    {l.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
