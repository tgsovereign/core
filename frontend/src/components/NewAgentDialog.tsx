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
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [scheduledAt, setScheduledAt] = useState("");
  const [eventType, setEventType] = useState("message_received");
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
    setScheduledAt("");
    setEventType("message_received");
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
      if (taskType === "one_off") input.scheduled_at = scheduledAt;
      if (taskType === "event_driven") input.event_type = eventType;

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
        ? scheduledAt
        : eventType);

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
      <DialogContent className="sm:max-w-lg">
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
              <div className="grid gap-2">
                <Label htmlFor="scheduled-at">Run at</Label>
                <Input
                  id="scheduled-at"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>
            )}

            {taskType === "event_driven" && (
              <div className="grid gap-2">
                <Label>Event type</Label>
                <Select value={eventType} onValueChange={(v) => v && setEventType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="message_received">
                      Message received
                    </SelectItem>
                  </SelectContent>
                </Select>
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
