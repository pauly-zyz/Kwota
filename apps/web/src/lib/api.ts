import { config, demoMode } from "./config";
import { DemoError, mockApi } from "./mockApi";

const TOKEN_KEY = "kwota.session";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event("kwota-session"));
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/** Address encoded in a session token (client-side decode only; the server verifies). */
export function tokenAddress(token: string | null): string | null {
  if (!token?.startsWith("kws_")) return null;
  try {
    const p = JSON.parse(atob(token.slice(4).split(".")[0]!.replace(/-/g, "+").replace(/_/g, "/")));
    return p.exp * 1000 > Date.now() ? (p.address as string) : null;
  } catch {
    return null;
  }
}

export function demoToken(address: string) {
  const payload = btoa(JSON.stringify({ address: address.toLowerCase(), exp: Math.floor(Date.now() / 1000) + 7 * 86_400, demo: true }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `kws_${payload}.demo`;
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown; auth?: boolean } = {}): Promise<T> {
  if (demoMode) {
    try {
      return (await mockApi(tokenAddress(getToken()), path, init.method ?? "GET", init.json)) as T;
    } catch (e) {
      if (e instanceof DemoError) throw new ApiError(e.status, e.code, e.message);
      throw e;
    }
  }
  if (!config.apiUrl) throw new ApiError(0, "no_api", "API is not configured");
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set("content-type", "application/json");
  const token = getToken();
  if (init.auth !== false && token) headers.set("authorization", `Bearer ${token}`);
  const res = await fetch(`${config.apiUrl}${path}`, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body });
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } })?.error;
    if (res.status === 401 && init.auth !== false) setToken(null);
    throw new ApiError(res.status, err?.code ?? "error", err?.message ?? `Request failed (${res.status})`);
  }
  return data as T;
}
