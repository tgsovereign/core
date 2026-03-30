"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import { getToken } from "@/lib/api";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

// Helper messages use request_id; agent service messages use agent_task_id
export type WsMessage =
  | {
      type: "agent_response";
      request_id: string;
      content: string;
      done: boolean;
    }
  | {
      type: "agent_tool_execution";
      request_id: string;
      tool: string;
      arguments: Record<string, unknown>;
      status: "running" | "done";
      result?: unknown;
    }
  | {
      type: "conversation_title_updated";
      request_id: string;
      conversation_id: string;
      title: string;
    }
  | {
      type: "agent_response";
      agent_task_id: string;
      content: string;
      done: boolean;
    }
  | {
      type: "agent_tool_execution";
      agent_task_id: string;
      tool: string;
      arguments: Record<string, unknown>;
      status: "running" | "done";
      result?: unknown;
    };

type Listener = (msg: WsMessage) => void;

type SocketContextValue = {
  send: (data: Record<string, unknown>) => void;
  addListener: (fn: Listener) => () => void;
  connected: boolean;
};

const SocketContext = createContext<SocketContextValue>({
  send: () => {},
  addListener: () => () => {},
  connected: false,
});

export function SocketProvider({ children }: { children: ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Set<Listener>>(new Set());
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriesRef = useRef(0);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;

    function connect() {
      const token = getToken();
      if (!token || unmountedRef.current) return;

      const ws = new WebSocket(`${WS_BASE}/api/ws?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        retriesRef.current = 0;
        setConnected(true);
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        scheduleReconnect();
      };

      ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);
          listenersRef.current.forEach((fn) => fn(msg));
        } catch {
          // ignore non-JSON messages
        }
      };
    }

    function scheduleReconnect() {
      if (unmountedRef.current) return;

      const delay = Math.min(
        RECONNECT_BASE_MS * 2 ** retriesRef.current,
        RECONNECT_MAX_MS,
      );
      retriesRef.current += 1;

      reconnectTimer.current = setTimeout(connect, delay);
    }

    connect();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, []);

  const send = useCallback((data: Record<string, unknown>) => {
    wsRef.current?.send(JSON.stringify(data));
  }, []);

  const addListener = useCallback((fn: Listener) => {
    listenersRef.current.add(fn);
    return () => {
      listenersRef.current.delete(fn);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ send, addListener, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
