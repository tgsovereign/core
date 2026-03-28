"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CalendarClock,
  Check,
  Clock,
  MessageSquare,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Send,
  ChevronDown,
  Lock,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  type AgentTask,
  getAgentTask,
  enableAgentTask,
  disableAgentTask,
  updateAgentTask,
} from "@/lib/agent-tasks";
import { cn } from "@/lib/utils";

const PERM_LEVELS = [
  {
    value: "read_only",
    label: "Read only",
    desc: "List chats, read & search messages",
    icon: Shield,
    variant: "outline" as const,
    accent: "text-muted-foreground",
    bg: "bg-muted/60",
  },
  {
    value: "read_write",
    label: "Read & Write",
    desc: "Above + send messages",
    icon: ShieldCheck,
    variant: "secondary" as const,
    accent: "text-sky-400",
    bg: "bg-sky-500/15",
  },
  {
    value: "full_autonomy",
    label: "Full autonomy",
    desc: "All Telegram actions, unrestricted",
    icon: ShieldAlert,
    variant: "destructive" as const,
    accent: "text-amber-400",
    bg: "bg-amber-500/15",
  },
] as const;

const TYPE_INFO: Record<string, { label: string; icon: typeof Clock }> = {
  one_off: { label: "One-off", icon: CalendarClock },
  cron: { label: "Recurring", icon: Clock },
  event_driven: { label: "Event-driven", icon: MessageSquare },
};

function cronToHuman(expr: string): string {
  const parts = expr.split(" ");
  if (parts.length !== 5) return expr;
  const [min, hour, dom, , ] = parts;

  if (min === "*" && hour === "*") return "Every minute";
  if (min.startsWith("*/") && hour === "*") return `Every ${min.slice(2)} minutes`;
  if (min === "0" && hour === "*") return "Every hour";
  if (min === "0" && hour.startsWith("*/")) return `Every ${hour.slice(2)} hours`;
  if (dom === "*" && !hour.startsWith("*/")) {
    const h = parseInt(hour);
    const m = parseInt(min);
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `Daily at ${h12}:${m.toString().padStart(2, "0")} ${period}`;
  }
  if (dom.startsWith("*/")) {
    const h = parseInt(hour);
    const m = parseInt(min);
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `Every ${dom.slice(2)} days at ${h12}:${m.toString().padStart(2, "0")} ${period}`;
  }
  return expr;
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Clock;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted/60">
        <Icon className="h-3 w-3 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
          {label}
        </span>
        <div className="text-xs text-foreground">{children}</div>
      </div>
    </div>
  );
}

export default function AgentHeaderInfo({ agentId }: { agentId: string }) {
  const [task, setTask] = useState<AgentTask | null>(null);

  useEffect(() => {
    getAgentTask(agentId)
      .then(setTask)
      .catch(() => {});
  }, [agentId]);

  if (!task) return null;

  const perm = PERM_LEVELS.find((l) => l.value === task.permission_level) ?? PERM_LEVELS[0];
  const PermIcon = perm.icon;
  const typeInfo = TYPE_INFO[task.task_type] ?? TYPE_INFO.cron;
  const TypeIcon = typeInfo.icon;

  return (
    <div className="flex items-center gap-1">
      {/* Permission level */}
      {task.can_edit_permission ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none">
            <PermIcon className="h-4 w-4" />
            <Badge variant={perm.variant} className="text-xs">
              {perm.label}
            </Badge>
            <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 p-0 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2.5 border-b border-border/50 px-3.5 py-2.5">
              <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", perm.bg)}>
                <PermIcon className={cn("h-3.5 w-3.5", perm.accent)} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Permissions</p>
                <p className="text-[10px] text-muted-foreground">Controls what the agent can do</p>
              </div>
            </div>

            {/* Level options */}
            <div className="px-1.5 py-1.5">
              {PERM_LEVELS.map((l) => {
                const LIcon = l.icon;
                const isActive = l.value === task.permission_level;
                return (
                  <button
                    key={l.value}
                    type="button"
                    onClick={async () => {
                      if (l.value === task.permission_level) return;
                      const prev = task.permission_level;
                      setTask((t) => t ? { ...t, permission_level: l.value } : t);
                      try {
                        await updateAgentTask(task.id, { permission_level: l.value });
                      } catch {
                        setTask((t) => t ? { ...t, permission_level: prev } : t);
                      }
                    }}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-left transition-colors",
                      isActive ? "bg-accent" : "hover:bg-accent/50",
                    )}
                  >
                    <div className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded", l.bg)}>
                      <LIcon className={cn("h-3 w-3", l.accent)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium">{l.label}</span>
                        {isActive && <Check className="h-3 w-3 text-emerald-400" />}
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
      ) : (
        <div className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm opacity-60 cursor-not-allowed" title="Cannot edit permission after scheduled time">
          <Lock className="h-3 w-3 text-muted-foreground" />
          <PermIcon className="h-4 w-4" />
          <Badge variant={perm.variant} className="text-xs">
            {perm.label}
          </Badge>
        </div>
      )}

      {/* Task type dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none">
          <TypeIcon className="h-4 w-4" />
          <Badge variant="outline" className="text-xs">
            {typeInfo.label}
          </Badge>
          <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60 p-0 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2.5 border-b border-border/50 px-3.5 py-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-500/15">
              <TypeIcon className="h-3.5 w-3.5 text-violet-400" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{task.name}</p>
              <p className="text-[10px] text-muted-foreground">{typeInfo.label} agent</p>
            </div>
          </div>

          {/* Details */}
          <div className="px-3.5 py-2">
            {task.task_type === "cron" && task.cron_expression && (
              <DetailRow icon={Clock} label="Schedule">
                <span>{cronToHuman(task.cron_expression)}</span>
                <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                  ({task.cron_expression})
                </span>
              </DetailRow>
            )}

            {task.task_type === "event_driven" && task.event_config && (
              <>
                <DetailRow icon={MessageSquare} label="Trigger">
                  {(task.event_config.event ?? "unknown").replace(/_/g, " ")}
                </DetailRow>
                {task.event_config.filters && Object.keys(task.event_config.filters).length > 0 && (() => {
                  const f = task.event_config!.filters!;
                  const chats = f.chats as string[] | undefined;
                  const pattern = f.pattern as string | undefined;
                  return (
                    <DetailRow icon={Clock} label="Filters">
                      <div className="flex flex-col gap-0.5">
                        {chats && (
                          <span>
                            Chats: <span className="font-mono text-[10px] text-muted-foreground">{chats.join(", ")}</span>
                          </span>
                        )}
                        {pattern && (
                          <span>
                            Pattern: <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{pattern}</code>
                          </span>
                        )}
                      </div>
                    </DetailRow>
                  );
                })()}
              </>
            )}

            {task.task_type === "one_off" && task.scheduled_at && (
              <DetailRow icon={CalendarClock} label="Scheduled">
                {new Date(task.scheduled_at).toLocaleString()}
              </DetailRow>
            )}

            <div className="flex items-center justify-between py-1.5">
              <div className="flex items-start gap-3">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted/60">
                  <Zap className="h-3 w-3 text-muted-foreground" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                    Status
                  </span>
                  <span
                    className={cn(
                      "text-xs",
                      task.enabled ? "text-emerald-400" : "text-muted-foreground",
                    )}
                  >
                    {task.enabled ? "Active" : "Paused"}
                  </span>
                </div>
              </div>
              <Switch
                size="sm"
                checked={task.enabled}
                onCheckedChange={async (checked) => {
                  setTask((prev) => prev ? { ...prev, enabled: checked } : prev);
                  try {
                    if (checked) {
                      await enableAgentTask(task.id);
                    } else {
                      await disableAgentTask(task.id);
                    }
                  } catch {
                    setTask((prev) => prev ? { ...prev, enabled: !checked } : prev);
                  }
                }}
              />
            </div>

            <DetailRow icon={Send} label="Telegram">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5",
                  task.has_telegram_session ? "text-sky-400" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-1.5 w-1.5 rounded-full",
                    task.has_telegram_session ? "bg-sky-400" : "bg-muted-foreground/50",
                  )}
                />
                {task.has_telegram_session ? "Connected" : "Not connected"}
              </span>
            </DetailRow>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
