const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function isLoggedIn(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((c) => c.startsWith("logged_in="));
}

export async function api<T>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((opts.headers as Record<string, string>) ?? {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
