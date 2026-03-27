"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Plus,
  Trash2,
  LogOut,
  Key,
  ChevronsUpDown,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import { useSocket, WsMessage } from "@/hooks/useSocket";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";
import { api, getToken } from "@/lib/api";
import type { TgUser } from "@/app/chat/layout";

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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const { addListener } = useSocket();

  const activeId = pathname.startsWith("/chat/")
    ? pathname.split("/chat/")[1]
    : null;

  useEffect(() => {
    listConversations()
      .then(setConversations)
      .catch(() => {});
  }, [pathname]);

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

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) {
        navigate("/chat");
      }
    } catch {
      // ignore
    }
  }

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
      <div className="flex h-14 items-center px-4">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => navigate("/chat")}
        >
          <Plus className="h-4 w-4" />
          New chat
        </Button>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => navigate(`/chat/${conv.id}`)}
              className={cn(
                "group flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
                activeId === conv.id
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate">{conv.title}</p>
                <p className="text-xs text-muted-foreground/60">
                  {timeAgo(conv.updated_at)}
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger
                  className="ml-1 inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive lg:hidden lg:group-hover:inline-flex"
                  onClick={(e) => handleDelete(e, conv.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </TooltipTrigger>
                <TooltipContent side="right">Delete chat</TooltipContent>
              </Tooltip>
            </div>
          ))}
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
        <DropdownMenuContent side={isMobile ? "top" : "right"} align="end" sideOffset={4}>
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
    </>
  );
}
