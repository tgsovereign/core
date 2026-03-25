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
      conversation_id: string;
      title: string;
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

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const ws = new WebSocket(`${WS_BASE}/api/ws?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        listenersRef.current.forEach((fn) => fn(msg));
      } catch {
        // ignore non-JSON messages
      }
    };

    return () => {
      ws.close();
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
