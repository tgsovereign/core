"use client";

import { useEffect, useState, useCallback, createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import { clearToken, api } from "@/lib/api";
import { SocketProvider } from "@/hooks/useSocket";
import { useSwipeRight } from "@/hooks/useSwipeRight";
import Image from "next/image";
import { Menu } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import Sidebar from "@/components/Sidebar";
import PermissionToggle, { type Level } from "@/components/PermissionToggle";
import AgentHeaderInfo from "@/components/AgentHeaderInfo";

export type TgUser = {
  id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
};

type PermissionContextValue = {
  permissionLevel: Level;
};

const PermissionContext = createContext<PermissionContextValue>({
  permissionLevel: "read_only",
});

export function usePermission() {
  return useContext(PermissionContext);
}

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<TgUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [permissionLevel, setPermissionLevel] = useState<Level>("read_only");
  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  useSwipeRight(openSidebar);

  // Extract conversation ID from path like /chat/<uuid>
  const match = pathname.match(/^\/chat\/([^/]+)$/);
  const conversationId = match ? match[1] : null;

  // Extract agent ID from path like /chat/agent/<uuid>
  const agentMatch = pathname.match(/^\/chat\/agent\/([^/]+)$/);
  const agentId = agentMatch ? agentMatch[1] : null;

  useEffect(() => {
    api<TgUser>("/api/auth/me")
      .then(setUser)
      .catch(() => {
        clearToken();
        router.replace("/");
      });
  }, [router]);

  function handleLogout() {
    clearToken();
    router.replace("/");
  }

  if (!user) return null;

  return (
    <SocketProvider>
      <PermissionContext.Provider value={{ permissionLevel }}>
        <div className="flex h-full">
          <Sidebar
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            user={user}
            onLogout={handleLogout}
          />
          <div className="flex flex-1 flex-col min-w-0">
            <header className="flex h-14 items-center justify-between px-4 sm:px-6">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <Image src="/logo.svg" alt="Sovereign" width={28} height={28} className="hidden sm:block" />
                <h1 className="hidden sm:block text-lg font-semibold tracking-tight">
                  Sovereign
                </h1>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                {agentId ? (
                  <AgentHeaderInfo agentId={agentId} />
                ) : (
                  <PermissionToggle
                    conversationId={conversationId}
                    onLevelChange={setPermissionLevel}
                  />
                )}
              </div>
            </header>
            <Separator />
            <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
          </div>
        </div>
      </PermissionContext.Provider>
    </SocketProvider>
  );
}
