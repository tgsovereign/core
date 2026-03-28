"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Bot,
  Plus,
  Trash2,
  LogOut,
  Key,
  ChevronsUpDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  Clock,
  CalendarClock,
  MessageSquare,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Conversation,
  listConversations,
  deleteConversation,
} from "@/lib/conversations";
import {
  type AgentTask,
  listAgentTasks,
  deleteAgentTask,
} from "@/lib/agent-tasks";
import { useSocket, WsMessage } from "@/hooks/useSocket";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";
import { api, getToken } from "@/lib/api";
import type { TgUser } from "@/app/chat/layout";
import NewAgentDialog from "@/components/NewAgentDialog";

const PAGE_SIZE = 30;

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const AGENT_TYPE_ICON: Record<
  string,
  { icon: typeof Clock; color: string; bg: string }
> = {
  cron: { icon: Clock, color: "text-violet-400", bg: "bg-violet-400/10" },
  one_off: { icon: CalendarClock, color: "text-sky-400", bg: "bg-sky-400/10" },
  event_driven: {
    icon: MessageSquare,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
  },
};

const PERM_ICON: Record<
  string,
  { icon: typeof Shield; color: string; bg: string }
> = {
  read_only: {
    icon: Shield,
    color: "text-perm-readonly",
    bg: "bg-perm-readonly-bg",
  },
  read_write: {
    icon: ShieldCheck,
    color: "text-perm-readwrite",
    bg: "bg-perm-readwrite-bg",
  },
  full_autonomy: {
    icon: ShieldAlert,
    color: "text-perm-autonomy",
    bg: "bg-perm-autonomy-bg",
  },
};

function SidebarItem({
  id,
  title,
  updatedAt,
  activeId,
  onNavigate,
  onDelete,
  navigatePath,
  badge,
  dimmed,
}: {
  id: string;
  title: string;
  updatedAt: string;
  activeId: string | null;
  onNavigate: (path: string) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  navigatePath: string;
  badge?: { icon: typeof Clock; color: string; bg: string };
  dimmed?: boolean;
}) {
  const BadgeIcon = badge?.icon;
  return (
    <div
      onClick={() => onNavigate(navigatePath)}
      className={cn(
        "group flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
        activeId === id
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
      )}
    >
      {BadgeIcon && (
        <div
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
            badge.bg,
          )}
        >
          <BadgeIcon className={cn("h-3.5 w-3.5", badge.color)} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("truncate", dimmed && "opacity-50")}>{title}</p>
        <p className="text-[11px] text-muted-foreground/50">
          {timeAgo(updatedAt)}
        </p>
      </div>
      <Tooltip>
        <TooltipTrigger
          className="ml-1 inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive lg:hidden lg:group-hover:inline-flex"
          onClick={(e) => onDelete(e, id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </TooltipTrigger>
        <TooltipContent side="right">Delete</TooltipContent>
      </Tooltip>
    </div>
  );
}

function InfiniteScrollSentinel({
  hasMore,
  loading,
  onLoadMore,
}: {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || loading) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onLoadMore();
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore]);

  if (!hasMore) return null;

  return (
    <div ref={sentinelRef} className="flex justify-center py-2">
      {loading && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}

export default function Sidebar({
  open,
  onClose,
  user,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  user: TgUser;
  onLogout: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const { addListener } = useSocket();

  const activeConvId =
    pathname.startsWith("/chat/") && !pathname.startsWith("/chat/agent/")
      ? pathname.split("/chat/")[1]
      : null;

  const activeAgentId = pathname.startsWith("/chat/agent/")
    ? pathname.split("/chat/agent/")[1]
    : null;

  const agentsEnabled =
    process.env.NEXT_PUBLIC_SOVEREIGN_AGENTS_ENABLED === "true";

  // Agent tasks state
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);
  const [agentTotal, setAgentTotal] = useState(0);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentsOpen, setAgentsOpen] = useState(true);

  // Conversations state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convTotal, setConvTotal] = useState(0);
  const [convLoading, setConvLoading] = useState(false);
  const [chatsOpen, setChatsOpen] = useState(true);

  // Initial load
  useEffect(() => {
    if (agentsEnabled) {
      listAgentTasks({ limit: PAGE_SIZE, offset: 0 })
        .then((page) => {
          setAgentTasks(page.items);
          setAgentTotal(page.total);
        })
        .catch(() => {});
    }
    listConversations({ limit: PAGE_SIZE, offset: 0 })
      .then((page) => {
        setConversations(page.items);
        setConvTotal(page.total);
      })
      .catch(() => {});
  }, [pathname, agentsEnabled]);

  const loadMoreAgents = useCallback(() => {
    if (agentLoading) return;
    setAgentLoading(true);
    listAgentTasks({ limit: PAGE_SIZE, offset: agentTasks.length })
      .then((page) => {
        setAgentTasks((prev) => [...prev, ...page.items]);
        setAgentTotal(page.total);
      })
      .catch(() => {})
      .finally(() => setAgentLoading(false));
  }, [agentTasks.length, agentLoading]);

  const loadMoreConversations = useCallback(() => {
    if (convLoading) return;
    setConvLoading(true);
    listConversations({ limit: PAGE_SIZE, offset: conversations.length })
      .then((page) => {
        setConversations((prev) => [...prev, ...page.items]);
        setConvTotal(page.total);
      })
      .catch(() => {})
      .finally(() => setConvLoading(false));
  }, [conversations.length, convLoading]);

  // WS title updates
  const handleTitleUpdate = useCallback((msg: WsMessage) => {
    if (msg.type === "conversation_title_updated") {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === msg.conversation_id ? { ...c, title: msg.title } : c,
        ),
      );
    }
  }, []);

  useEffect(
    () => addListener(handleTitleUpdate),
    [addListener, handleTitleUpdate],
  );

  function navigate(path: string) {
    router.push(path);
    onClose();
  }

  async function handleDeleteConversation(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setConvTotal((prev) => prev - 1);
      if (activeConvId === id) navigate("/chat");
    } catch {
      // ignore
    }
  }

  async function handleDeleteAgent(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    try {
      await deleteAgentTask(id);
      setAgentTasks((prev) => prev.filter((t) => t.id !== id));
      setAgentTotal((prev) => prev - 1);
      if (activeAgentId === id) navigate("/chat");
    } catch {
      // ignore
    }
  }

  const [newAgentOpen, setNewAgentOpen] = useState(false);
  const [apiKeyOpen, setApiKeyOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyLoading, setApiKeyLoading] = useState(false);

  async function handleSaveApiKey(e: React.FormEvent) {
    e.preventDefault();
    setApiKeyLoading(true);
    try {
      await api<{ saved: boolean }>("/api/auth/api-key", {
        method: "POST",
        body: JSON.stringify({ api_key: apiKey }),
      });
      setApiKeyOpen(false);
      setApiKey("");
      toast.success("API key updated successfully");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save API key",
      );
    } finally {
      setApiKeyLoading(false);
    }
  }

  const sidebarContent = (
    <aside className="flex h-full w-[280px] flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Action buttons */}
      <div className="flex gap-2 px-4 pt-4 pb-2">
        {agentsEnabled && (
          <Button
            variant="outline"
            className="flex-1 justify-start gap-2"
            onClick={() => setNewAgentOpen(true)}
          >
            <Bot className="h-4 w-4" />
            Agent
          </Button>
        )}
        <Button
          variant="outline"
          className="flex-1 justify-start gap-2"
          onClick={() => navigate("/chat")}
        >
          <Plus className="h-4 w-4" />
          Chat
        </Button>
      </div>

      {/* Scrollable sections */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-1">
          {/* Agents section */}
          {agentsEnabled ? (
            <Collapsible open={agentsOpen} onOpenChange={setAgentsOpen}>
              <CollapsibleTrigger className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-sidebar-accent/50 transition-colors cursor-pointer">
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200",
                    agentsOpen && "rotate-90",
                  )}
                />
                Agents
                <span className="ml-auto text-[10px] font-normal tabular-nums">
                  {agentTotal}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-0.5 pt-1">
                  {agentTasks.map((task) => (
                    <SidebarItem
                      key={task.id}
                      id={task.id}
                      title={task.name}
                      updatedAt={task.updated_at}
                      activeId={activeAgentId}
                      onNavigate={navigate}
                      onDelete={handleDeleteAgent}
                      navigatePath={`/chat/agent/${task.id}`}
                      badge={AGENT_TYPE_ICON[task.task_type]}
                      dimmed={!task.enabled}
                    />
                  ))}
                  <InfiniteScrollSentinel
                    hasMore={agentTasks.length < agentTotal}
                    loading={agentLoading}
                    onLoadMore={loadMoreAgents}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <div className="mx-1 mb-2 overflow-hidden rounded-lg border border-border/40 bg-gradient-to-b from-violet-500/[0.03] to-transparent">
              <Empty className="border-0 p-4 gap-2.5">
                <EmptyHeader className="gap-1.5">
                  <EmptyMedia
                    variant="icon"
                    className="bg-violet-500/10 text-violet-400"
                  >
                    <Sparkles className="h-4 w-4" />
                  </EmptyMedia>
                  <EmptyTitle className="text-xs">Cloud Agents</EmptyTitle>
                  <EmptyDescription className="text-[11px] leading-relaxed">
                    Autonomous agents that run on a schedule or react to
                    Telegram events — available on{" "}
                    <a
                      href="https://web.tgsovereign.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      Sovereign Cloud
                    </a>
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          )}

          {/* Chats section */}
          <Collapsible open={chatsOpen} onOpenChange={setChatsOpen}>
            <CollapsibleTrigger className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-sidebar-accent/50 transition-colors cursor-pointer">
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  chatsOpen && "rotate-90",
                )}
              />
              Chats
              <span className="ml-auto text-[10px] font-normal tabular-nums">
                {convTotal}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-0.5 pt-1">
                {conversations.map((conv) => (
                  <SidebarItem
                    key={conv.id}
                    id={conv.id}
                    title={conv.title}
                    updatedAt={conv.updated_at}
                    activeId={activeConvId}
                    onNavigate={navigate}
                    onDelete={handleDeleteConversation}
                    navigatePath={`/chat/${conv.id}`}
                    badge={PERM_ICON[conv.permission_level]}
                  />
                ))}
                <InfiniteScrollSentinel
                  hasMore={conversations.length < convTotal}
                  loading={convLoading}
                  onLoadMore={loadMoreConversations}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>

      <Separator />
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-sidebar-accent/50 focus:outline-none">
          <Avatar>
            <AvatarImage
              src={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/auth/me/photo?token=${getToken()}`}
              alt={user.first_name ?? "User"}
            />
            <AvatarFallback>
              {(user.first_name?.[0] ?? "").toUpperCase()}
              {(user.last_name?.[0] ?? "").toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {[user.first_name, user.last_name].filter(Boolean).join(" ") ||
                "User"}
            </p>
            {user.username && (
              <p className="truncate text-xs text-muted-foreground">
                @{user.username}
              </p>
            )}
          </div>
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={isMobile ? "top" : "right"}
          align="end"
          sideOffset={4}
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-3 px-2 py-1.5 text-left text-sm">
                <Avatar>
                  <AvatarImage
                    src={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/auth/me/photo?token=${getToken()}`}
                    alt={user.first_name ?? "User"}
                  />
                  <AvatarFallback>
                    {(user.first_name?.[0] ?? "").toUpperCase()}
                    {(user.last_name?.[0] ?? "").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {[user.first_name, user.last_name]
                      .filter(Boolean)
                      .join(" ") || "User"}
                  </p>
                  {user.username && (
                    <p className="truncate text-xs text-muted-foreground">
                      @{user.username}
                    </p>
                  )}
                </div>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setApiKeyOpen(true)}>
            <Key className="h-4 w-4" />
            Update OpenAI Key
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </aside>
  );

  return (
    <>
      {/* Desktop: static sidebar */}
      <div className="hidden lg:block">{sidebarContent}</div>

      {/* Mobile: overlay sidebar */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {sidebarContent}
      </div>

      {/* Dialogs rendered once, outside sidebarContent */}
      <Dialog
        open={apiKeyOpen}
        onOpenChange={(open) => {
          setApiKeyOpen(open);
          if (!open) setApiKey("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update OpenAI API Key</DialogTitle>
            <DialogDescription>
              Enter your new API key. You can find it at{" "}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 underline"
              >
                platform.openai.com/api-keys
                <ExternalLink className="h-3 w-3" />
              </a>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveApiKey}>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="openai-key">API Key</Label>
                <Input
                  id="openai-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  autoFocus
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Your key is encrypted and stored securely.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={apiKeyLoading || !apiKey.trim()}>
                {apiKeyLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Key
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {agentsEnabled && (
        <NewAgentDialog
          open={newAgentOpen}
          onOpenChange={setNewAgentOpen}
          onCreated={(task) => {
            toast.success(`Agent "${task.name}" created`);
            setNewAgentOpen(false);
            setAgentTasks((prev) => [task, ...prev]);
            setAgentTotal((prev) => prev + 1);
          }}
        />
      )}
    </>
  );
}
