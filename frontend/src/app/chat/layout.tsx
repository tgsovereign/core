"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, clearToken, api } from "@/lib/api";
import { SocketProvider } from "@/hooks/useSocket";
import { Menu } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import Sidebar from "@/components/Sidebar";
import PermissionToggle from "@/components/PermissionToggle";

export type TgUser = {
  id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<TgUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }
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
              <h1 className="text-lg font-semibold tracking-tight">
                Sovereign
              </h1>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <PermissionToggle />
            </div>
          </header>
          <Separator />
          <div className="flex flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </SocketProvider>
  );
}
