"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Bot,
  CalendarClock,
  Clock,
  Loader2,
  MessageSquare,
  Check,
  Shield,
  ShieldCheck,
  ShieldAlert,
  MessageCircle,
  Pencil,
  Trash2,
  UserPlus,
  UserMinus,
  Filter,
  Hash,
  User,
  Regex,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type AgentTask,
  type AgentTaskType,
  createAgentTask,
  deleteAgentTask,
  agentAuthSendCode,
  agentAuthVerifyCode,
  agentAuthVerify2FA,
} from "@/lib/agent-tasks";
import { cn } from "@/lib/utils";

type WizardStep = "type" | "prompt" | "telegram" | "done";
type TelegramStep = "phone" | "code" | "2fa";

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "type", label: "Configure" },
  { key: "prompt", label: "Instructions" },
  { key: "telegram", label: "Telegram" },
  { key: "done", label: "Done" },
];

function StepIndicator({ current }: { current: WizardStep }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center justify-between px-2">
      {STEPS.map((s, i) => {
        const isDone = i < currentIdx;
        const isActive = i === currentIdx;

        return (
          <div key={s.key} className="flex items-center flex-1 last:flex-none">
            {/* Circle */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  isDone
                    ? "bg-primary text-primary-foreground"
                    : isActive
                      ? "border-2 border-primary text-primary"
                      : "border-2 border-muted-foreground/30 text-muted-foreground/50",
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[10px]",
                  isActive
                    ? "font-medium text-foreground"
                    : "text-muted-foreground/60",
                )}
              >
                {s.label}
              </span>
            </div>
            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-2 h-0.5 flex-1 -mt-4 rounded-full transition-colors",
                  i < currentIdx ? "bg-primary" : "bg-muted-foreground/20",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

const PERM_OPTIONS: {
  value: string;
  label: string;
  description: string;
  icon: typeof Shield;
}[] = [
  {
    value: "read_only",
    label: "Read only",
    description: "Can read messages but not send",
    icon: Shield,
  },
  {
    value: "read_write",
    label: "Read & Write",
    description: "Can read and send messages",
    icon: ShieldCheck,
  },
  {
    value: "full_autonomy",
    label: "Full autonomy",
    description: "Can take any action autonomously",
    icon: ShieldAlert,
  },
];

const TYPE_OPTIONS: {
  value: AgentTaskType;
  label: string;
  description: string;
  icon: typeof Clock;
}[] = [
  {
    value: "one_off",
    label: "One-off",
    description: "Run once at a specific time",
    icon: CalendarClock,
  },
  {
    value: "cron",
    label: "Recurring",
    description: "Run on a schedule (cron)",
    icon: Clock,
  },
  {
    value: "event_driven",
    label: "Event-driven",
    description: "React to Telegram events",
    icon: MessageSquare,
  },
];

export default function NewAgentDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (task: AgentTask) => void;
}) {
  // Wizard state
  const [step, setStep] = useState<WizardStep>("type");

  // Step 1: Type selection
  const [name, setName] = useState("");
  const [taskType, setTaskType] = useState<AgentTaskType>("cron");
  const [cronExpression, setCronExpression] = useState("");
  const [scheduleFrequency, setScheduleFrequency] = useState<"minutes" | "hours" | "days">("hours");
  const [scheduleInterval, setScheduleInterval] = useState("1");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState("12:00");
  const [eventName, setEventName] = useState("new_message");
  const [eventFilterChats, setEventFilterChats] = useState("");
  const [eventFilterFromUser, setEventFilterFromUser] = useState("");
  const [eventFilterPattern, setEventFilterPattern] = useState("");
  const [permissionLevel, setPermissionLevel] = useState("read_only");

  // Step 2: System prompt
  const [systemPrompt, setSystemPrompt] = useState("");

  // Step 3: Telegram auth
  const [telegramStep, setTelegramStep] = useState<TelegramStep>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [phoneCodeHash, setPhoneCodeHash] = useState("");
  const [createdTask, setCreatedTask] = useState<AgentTask | null>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setStep("type");
    setName("");
    setTaskType("cron");
    setCronExpression("");
    setScheduleFrequency("hours");
    setScheduleInterval("1");
    setScheduleTime("09:00");
    setScheduledDate(undefined);
    setScheduledTime("12:00");
    setEventName("new_message");
    setEventFilterChats("");
    setEventFilterFromUser("");
    setEventFilterPattern("");
    setPermissionLevel("read_only");
    setSystemPrompt("");
    setTelegramStep("phone");
    setPhone("");
    setCode("");
    setPassword("");
    setPhoneCodeHash("");
    setCreatedTask(null);
    setError("");
    setLoading(false);
  }

  async function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      // If we created a task but never finished Telegram auth, clean it up
      if (createdTask && step !== "done") {
        try {
          await deleteAgentTask(createdTask.id);
        } catch {
          // best-effort cleanup
        }
      }
      reset();
    }
    onOpenChange(nextOpen);
  }

  function buildCronExpression(): string {
    const n = parseInt(scheduleInterval, 10) || 1;
    switch (scheduleFrequency) {
      case "minutes":
        return n === 1 ? "* * * * *" : `*/${n} * * * *`;
      case "hours":
        return n === 1 ? "0 * * * *" : `0 */${n} * * *`;
      case "days": {
        const [h, m] = scheduleTime.split(":").map(Number);
        return n === 1
          ? `${m} ${h} * * *`
          : `${m} ${h} */${n} * *`;
      }
      default:
        return "0 * * * *";
    }
  }

  // --- Step 3: Create task then start Telegram auth ---

  async function handleStartTelegram() {
    setError("");
    setLoading(true);
    try {
      const input: Parameters<typeof createAgentTask>[0] = {
        task_type: taskType,
        name,
        system_prompt: systemPrompt,
        permission_level: permissionLevel,
      };
      if (taskType === "cron") input.cron_expression = buildCronExpression();
      if (taskType === "one_off" && scheduledDate) {
        const [h, m] = scheduledTime.split(":").map(Number);
        const dt = new Date(scheduledDate);
        dt.setHours(h, m, 0, 0);
        input.scheduled_at = dt.toISOString();
      }
      if (taskType === "event_driven") {
        const filters: Record<string, unknown> = {};
        if (eventFilterChats.trim()) {
          filters.chats = eventFilterChats.split(",").map((s) => s.trim()).filter(Boolean);
        }
        if (eventFilterFromUser.trim()) {
          filters.from_user = eventFilterFromUser.trim();
        }
        if (eventFilterPattern.trim()) {
          filters.pattern = eventFilterPattern.trim();
        }
        input.event_config = { event: eventName, filters };
      }

      const task = await createAgentTask(input);
      setCreatedTask(task);
      setStep("telegram");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create agent task");
    } finally {
      setLoading(false);
    }
  }

  async function handlePhone(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await agentAuthSendCode(createdTask!.id, phone);
      setPhoneCodeHash(res.phone_code_hash);
      setTelegramStep("code");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  }

  async function handleCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await agentAuthVerifyCode(
        createdTask!.id,
        phone,
        code,
        phoneCodeHash,
      );
      if (res.needs_2fa) {
        setTelegramStep("2fa");
      } else {
        setStep("done");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  async function handle2FA(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await agentAuthVerify2FA(createdTask!.id, phone, password);
      setStep("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid password");
    } finally {
      setLoading(false);
    }
  }

  const canAdvanceFromType =
    name.trim() &&
    (taskType === "cron"
      ? parseInt(scheduleInterval, 10) > 0
      : taskType === "one_off"
        ? scheduledDate
        : eventName);

  const stepConfig: Record<WizardStep, { title: string; description: string }> =
    {
      type: {
        title: "Create a new agent",
        description: "Choose what kind of task this agent will perform",
      },
      prompt: {
        title: "Agent instructions",
        description: "Tell the agent what to do when it runs",
      },
      telegram: {
        title: "Connect Telegram account",
        description:
          "Each agent needs its own Telegram session. Log in with the account the agent should use.",
      },
      done: {
        title: "Agent created",
        description: "Your agent is ready to go",
      },
    };

  const { title, description } = stepConfig[step];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <StepIndicator current={step} />

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Step 1: Type selection */}
        {step === "type" && (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="agent-name">Name</Label>
              <Input
                id="agent-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My agent"
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label>Task type</Label>
              <div className="grid gap-2">
                {TYPE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTaskType(opt.value)}
                      className={cn(
                        "flex items-center gap-3 rounded-md border p-3 text-left text-sm transition-colors",
                        taskType === opt.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-accent/50",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-medium">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {opt.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {taskType === "cron" && (
              <div className="grid gap-2">
                <Label>Schedule</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">Every</span>
                  <Input
                    type="number"
                    min={1}
                    max={scheduleFrequency === "minutes" ? 59 : scheduleFrequency === "hours" ? 23 : 30}
                    value={scheduleInterval}
                    onChange={(e) => setScheduleInterval(e.target.value)}
                    className="w-20"
                  />
                  <Select value={scheduleFrequency} onValueChange={(v) => v && setScheduleFrequency(v as typeof scheduleFrequency)}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">minute(s)</SelectItem>
                      <SelectItem value="hours">hour(s)</SelectItem>
                      <SelectItem value="days">day(s)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {scheduleFrequency === "days" && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">at</span>
                    <Input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="w-32"
                    />
                  </div>
                )}
              </div>
            )}

            {taskType === "one_off" && (
              <div className="grid gap-3">
                <Label>Run at</Label>
                <div className="rounded-lg border border-border/40 bg-card/30 overflow-hidden">
                  <div className="flex items-center divide-x divide-border/30">
                    {/* Date picker */}
                    <Popover>
                      <PopoverTrigger
                        className={cn(
                          "flex flex-1 items-center gap-2.5 px-3 h-10 text-sm transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:bg-accent/30",
                          !scheduledDate && "text-muted-foreground",
                        )}
                      >
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky-400/10">
                          <CalendarClock className="h-3.5 w-3.5 text-sky-400" />
                        </div>
                        <span>
                          {scheduledDate
                            ? scheduledDate.toLocaleDateString(undefined, {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })
                            : "Pick a date"}
                        </span>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={scheduledDate}
                          onSelect={setScheduledDate}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        />
                      </PopoverContent>
                    </Popover>
                    {/* Time picker */}
                    <div className="flex items-center gap-2.5 px-3 h-10">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-violet-400/10">
                        <Clock className="h-3.5 w-3.5 text-violet-400" />
                      </div>
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="bg-transparent text-sm text-foreground outline-none [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:hover:opacity-80"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {taskType === "event_driven" && (
              <div className="grid gap-3">
                {/* Event type picker */}
                <Label>Trigger event</Label>
                {(() => {
                  const EVENT_OPTIONS = [
                    { value: "new_message", label: "New message", desc: "When a message is received", icon: MessageCircle, color: "text-sky-400", bg: "bg-sky-400/10" },
                    { value: "message_edited", label: "Message edited", desc: "When a message is modified", icon: Pencil, color: "text-amber-400", bg: "bg-amber-400/10" },
                    { value: "message_deleted", label: "Message deleted", desc: "When a message is removed", icon: Trash2, color: "text-red-400", bg: "bg-red-400/10" },
                    { value: "user_joined", label: "User joined", desc: "When someone enters a chat", icon: UserPlus, color: "text-emerald-400", bg: "bg-emerald-400/10" },
                    { value: "user_left", label: "User left", desc: "When someone leaves a chat", icon: UserMinus, color: "text-orange-400", bg: "bg-orange-400/10" },
                  ] as const;
                  const selected = EVENT_OPTIONS.find((e) => e.value === eventName) ?? EVENT_OPTIONS[0];
                  const SelectedIcon = selected.icon;
                  return (
                    <Select value={eventName} onValueChange={(v) => v && setEventName(v)}>
                      <SelectTrigger className="h-10 w-full">
                        <span className="flex items-center gap-2.5">
                          <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", selected.bg)}>
                            <SelectedIcon className={cn("h-3.5 w-3.5", selected.color)} />
                          </span>
                          <span className="text-sm">{selected.label}</span>
                        </span>
                      </SelectTrigger>
                      <SelectContent className="w-[--radix-select-trigger-width]">
                        {EVENT_OPTIONS.map((evt) => {
                          const Icon = evt.icon;
                          return (
                            <SelectItem key={evt.value} value={evt.value}>
                              <span className="flex items-center gap-2.5">
                                <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", evt.bg)}>
                                  <Icon className={cn("h-3.5 w-3.5", evt.color)} />
                                </span>
                                <span className="flex flex-col">
                                  <span className="text-sm font-medium">{evt.label}</span>
                                  <span className="text-[11px] text-muted-foreground">{evt.desc}</span>
                                </span>
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  );
                })()}

                {/* Filters — collapsible section */}
                <div className="mt-1 rounded-lg border border-border/40 bg-card/30">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
                    <Filter className="h-3 w-3 text-muted-foreground/60" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">Filters</span>
                    <span className="text-[10px] text-muted-foreground/40 ml-auto">optional</span>
                  </div>
                  <div className="grid gap-2.5 px-3 py-2.5">
                    {/* Chat ID filter */}
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted/40">
                        <Hash className="h-3 w-3 text-muted-foreground/70" />
                      </div>
                      <Input
                        value={eventFilterChats}
                        onChange={(e) => setEventFilterChats(e.target.value)}
                        placeholder="Chat IDs or @usernames"
                        className="h-7 text-xs bg-transparent border-border/40 placeholder:text-muted-foreground/30"
                      />
                    </div>

                    {/* From user filter */}
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted/40">
                        <User className="h-3 w-3 text-muted-foreground/70" />
                      </div>
                      <Input
                        value={eventFilterFromUser ?? ""}
                        onChange={(e) => setEventFilterFromUser(e.target.value)}
                        placeholder="From user ID or @username"
                        className="h-7 text-xs bg-transparent border-border/40 placeholder:text-muted-foreground/30"
                      />
                    </div>

                    {/* Regex pattern — only for message events */}
                    {(eventName === "new_message" || eventName === "message_edited") && (
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted/40">
                          <Regex className="h-3 w-3 text-muted-foreground/70" />
                        </div>
                        <Input
                          value={eventFilterPattern}
                          onChange={(e) => setEventFilterPattern(e.target.value)}
                          placeholder="Regex pattern e.g. ^/start|hello"
                          className="h-7 text-xs font-mono bg-transparent border-border/40 placeholder:text-muted-foreground/30"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                onClick={() => setStep("prompt")}
                disabled={!canAdvanceFromType}
              >
                Next
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2: System prompt */}
        {step === "prompt" && (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="system-prompt">System prompt</Label>
              <Textarea
                id="system-prompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="You are an agent that..."
                rows={6}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                These instructions tell the agent what to do each time it runs.
              </p>
            </div>

            <div className="grid gap-2">
              <Label>Permission level</Label>
              <div className="grid gap-2">
                {PERM_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPermissionLevel(opt.value)}
                      className={cn(
                        "flex items-center gap-3 rounded-md border p-3 text-left text-sm transition-colors",
                        permissionLevel === opt.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-accent/50",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-medium">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {opt.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="flex gap-2 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep("type");
                  setError("");
                }}
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleStartTelegram}
                disabled={loading || !systemPrompt.trim()}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Next
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Telegram auth */}
        {step === "telegram" && telegramStep === "phone" && (
          <form onSubmit={handlePhone}>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="agent-phone">Phone number</Label>
                <Input
                  id="agent-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 234 567 8900"
                  autoFocus
                  required
                />
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={loading || !phone.trim()}
                  className="w-full"
                >
                  {loading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Send Code
                </Button>
              </DialogFooter>
            </div>
          </form>
        )}

        {step === "telegram" && telegramStep === "code" && (
          <form onSubmit={handleCode}>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="agent-code">Verification code</Label>
                <Input
                  id="agent-code"
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="12345"
                  autoFocus
                  required
                />
              </div>
              <DialogFooter className="flex gap-2 sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setTelegramStep("phone");
                    setCode("");
                    setError("");
                  }}
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
                <Button type="submit" disabled={loading || !code.trim()}>
                  {loading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Verify
                </Button>
              </DialogFooter>
            </div>
          </form>
        )}

        {step === "telegram" && telegramStep === "2fa" && (
          <form onSubmit={handle2FA}>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="agent-password">2FA Password</Label>
                <Input
                  id="agent-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your 2FA password"
                  autoFocus
                  required
                />
              </div>
              <DialogFooter className="flex gap-2 sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setTelegramStep("code");
                    setPassword("");
                    setError("");
                  }}
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
                <Button type="submit" disabled={loading || !password.trim()}>
                  {loading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Submit
                </Button>
              </DialogFooter>
            </div>
          </form>
        )}

        {/* Step 4: Done */}
        {step === "done" && (
          <div className="grid gap-4">
            <div className="flex items-center justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Check className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="text-center text-sm text-muted-foreground">
              <p>
                Agent <span className="font-medium text-foreground">{name}</span>{" "}
                has been created and connected to Telegram.
              </p>
            </div>
            <DialogFooter>
              <Button
                className="w-full"
                onClick={() => {
                  if (createdTask) onCreated(createdTask);
                  handleOpenChange(false);
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
