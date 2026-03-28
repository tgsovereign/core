"use client";

import { Badge } from "@/components/ui/badge";
import {
  CalendarClock,
  Clock,
  MessageSquare,
  Shield,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import type { AgentTask } from "@/lib/agent-tasks";
import { cn } from "@/lib/utils";

const PERM_LEVELS = [
  { value: "read_only", label: "Read only", icon: Shield, variant: "outline" as const, accent: "text-perm-readonly" },
  { value: "read_write", label: "Read & Write", icon: ShieldCheck, variant: "secondary" as const, accent: "text-perm-readwrite" },
  { value: "full_autonomy", label: "Full autonomy", icon: ShieldAlert, variant: "destructive" as const, accent: "text-perm-autonomy" },
] as const;

const TYPE_LABELS: Record<string, { label: string; icon: typeof Clock }> = {
  one_off: { label: "One-off", icon: CalendarClock },
  cron: { label: "Cron", icon: Clock },
  event_driven: { label: "Event-driven", icon: MessageSquare },
};

export default function AgentTaskInfo({ task }: { task: AgentTask }) {
  const perm = PERM_LEVELS.find((l) => l.value === task.permission_level) ?? PERM_LEVELS[0];
  const PermIcon = perm.icon;
  const typeInfo = TYPE_LABELS[task.task_type] ?? TYPE_LABELS.cron;
  const TypeIcon = typeInfo.icon;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <div className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs">
        <PermIcon className={cn("h-3.5 w-3.5", perm.accent)} />
        <Badge variant={perm.variant} className="text-xs">
          {perm.label}
        </Badge>
      </div>
      <div className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs">
        <TypeIcon className="h-3.5 w-3.5" />
        <Badge variant="outline" className="text-xs">
          {typeInfo.label}
        </Badge>
      </div>
      {task.task_type === "cron" && task.cron_expression && (
        <Badge variant="outline" className="text-xs font-mono">
          {task.cron_expression}
        </Badge>
      )}
      {task.task_type === "event_driven" && task.event_config && (
        <Badge variant="outline" className="text-xs">
          {(task.event_config.event ?? "unknown").replace(/_/g, " ")}
        </Badge>
      )}
      {task.task_type === "one_off" && task.scheduled_at && (
        <Badge variant="outline" className="text-xs">
          {new Date(task.scheduled_at).toLocaleString()}
        </Badge>
      )}
    </div>
  );
}
