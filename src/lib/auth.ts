import { cookies } from "next/headers";
import { connection } from "next/server";
import { BoardRequestError } from "@/lib/db";

const ACCESS_COOKIE = "meridian_access";
const REFRESH_COOKIE = "meridian_refresh";

export type SessionUser = { id: string; email: string };

type TokenBundle = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  user?: { id?: string; email?: string };
};

function envPair(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new BoardRequestError(
      503,
      "Supabase isn't configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
  }
  return { url, key };
}

export function publicAppUrl(): string | null {
  const raw = process.env.MERIDIAN_PUBLIC_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function cookieBase(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

async function authFetch(path: string, init: RequestInit, useServiceAuth = false): Promise<Response> {
  const { url, key } = envPair();
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Content-Type", "application/json");
  if (useServiceAuth) headers.set("Authorization", `Bearer ${key}`);
  return fetch(`${url}${path}`, { ...init, headers, cache: "no-store" });
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error_description?: string; msg?: string; message?: string; error?: string };
    return body.error_description || body.msg || body.message || body.error || "";
  } catch {
    return "";
  }
}

function friendlyAuthError(status: number, detail: string): string {
  const text = detail.toLowerCase();
  if (text.includes("already") && (text.includes("registered") || text.includes("exists"))) {
    return "That email already has an account. Sign in instead.";
  }
  if (status === 400 || status === 401 || text.includes("invalid") || text.includes("credentials")) {
    return "That email or password does not match.";
  }
  if (text.includes("password")) return "Use at least 8 characters.";
  return "Sign-in did not go through. Try again in a moment.";
}

function requireEmail(value: unknown): string {
  if (typeof value !== "string") throw new BoardRequestError(400, "Enter your email.");
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BoardRequestError(400, "Enter a real email address.");
  return email;
}

function requirePassword(value: unknown): string {
  if (typeof value !== "string" || value.length < 8) {
    throw new BoardRequestError(400, "Use at least 8 characters.");
  }
  if (value.length > 72) throw new BoardRequestError(400, "Passwords stay under 72 characters.");
  return value;
}

async function storeSession(bundle: TokenBundle): Promise<SessionUser> {
  if (!bundle.access_token || !bundle.refresh_token || !bundle.user?.id || !bundle.user.email) {
    throw new BoardRequestError(502, "Sign-in did not go through. Try again in a moment.");
  }
  await connection();
  const jar = await cookies();
  const accessAge = typeof bundle.expires_in === "number" ? bundle.expires_in : 60 * 60;
  jar.set(ACCESS_COOKIE, bundle.access_token, cookieBase(accessAge));
  jar.set(REFRESH_COOKIE, bundle.refresh_token, cookieBase(60 * 60 * 24 * 30));
  return { id: bundle.user.id, email: bundle.user.email };
}

async function passwordGrant(email: string, password: string): Promise<SessionUser> {
  const response = await authFetch("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new BoardRequestError(401, friendlyAuthError(response.status, await readError(response)));
  }
  return storeSession((await response.json()) as TokenBundle);
}

export async function signInWithPassword(body: unknown): Promise<SessionUser> {
  if (!body || typeof body !== "object") throw new BoardRequestError(400, "That request was empty.");
  const record = body as Record<string, unknown>;
  return passwordGrant(requireEmail(record.email), requirePassword(record.password));
}

export async function signUpWithPassword(body: unknown): Promise<SessionUser> {
  if (!body || typeof body !== "object") throw new BoardRequestError(400, "That request was empty.");
  const record = body as Record<string, unknown>;
  const email = requireEmail(record.email);
  const password = requirePassword(record.password);
  const created = await authFetch(
    "/auth/v1/admin/users",
    {
      method: "POST",
      body: JSON.stringify({ email, password, email_confirm: true }),
    },
    true,
  );
  if (!created.ok) {
    const detail = await readError(created);
    const status = created.status === 422 ? 400 : created.status;
    throw new BoardRequestError(status >= 400 && status < 500 ? status : 502, friendlyAuthError(created.status, detail));
  }
  return passwordGrant(email, password);
}

export async function signOut(): Promise<void> {
  await connection();
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, "", cookieBase(0));
  jar.set(REFRESH_COOKIE, "", cookieBase(0));
}

async function userFromAccess(access: string): Promise<SessionUser | null> {
  const response = await authFetch("/auth/v1/user", {
    method: "GET",
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { id?: string; email?: string };
  if (!body.id || !body.email) return null;
  return { id: body.id, email: body.email };
}

async function refreshSession(refreshToken: string): Promise<SessionUser | null> {
  const response = await authFetch("/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) return null;
  return storeSession((await response.json()) as TokenBundle);
}

export async function requireUser(): Promise<SessionUser> {
  await connection();
  const jar = await cookies();
  const access = jar.get(ACCESS_COOKIE)?.value;
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  if (access) {
    const user = await userFromAccess(access);
    if (user) return user;
  }
  if (refresh) {
    const user = await refreshSession(refresh);
    if (user) return user;
  }
  throw new BoardRequestError(401, "Sign in to see this tree.");
}
