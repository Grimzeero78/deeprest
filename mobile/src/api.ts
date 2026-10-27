/**
 * DeepRest API client — talks to the SAME backend as the website.
 * Auth: JWT stored in SecureStore, sent as Authorization: Bearer.
 */
import * as SecureStore from "expo-secure-store";

const API_BASE = "https://deeprest-app.dev078.workers.dev";
const TOKEN_KEY = "deeprest_jwt";

export interface MeResponse {
  user: { id: string; name: string; username: string; totalPoints: number; streak: number };
  settings: { dailyTargetMin: number };
  today: {
    date: string;
    minutesUsed: number;
    targetMin: number;
    metTarget: boolean;
    topApps: { name: string; minutes: number }[];
  };
  rank: {
    current: { level: number; name: string };
    next: { name: string; minXp: number } | null;
    progressPercent: number;
    potentialTodayXp: number;
  };
  history: { date: string; minutesUsed: number; targetMin: number; metTarget: boolean }[];
}

export interface TopApp {
  name: string;
  minutes: number;
}

async function request<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as { error?: string }).error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body as T;
}

// ---------- token storage (hardware-backed keystore) ----------

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function loadToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ---------- auth ----------

export async function login(name: string, password: string): Promise<{ token: string; name: string }> {
  const body = await request<{ token: string; user: { name: string } }>(
    "/api/auth/login",
    null,
    { method: "POST", body: JSON.stringify({ name, password }) }
  );
  if (!body.token) throw new Error("No token returned by server");
  await saveToken(body.token);
  return { token: body.token, name: body.user.name };
}

export async function register(
  name: string,
  password: string,
  confirmPassword: string,
  hint: string
): Promise<{ token: string }> {
  const body = await request<{ token: string; user: { name: string } }>(
    "/api/auth/register",
    null,
    { method: "POST", body: JSON.stringify({ name, password, confirmPassword, hint }) }
  );
  if (!body.token) throw new Error("No token returned by server");
  await saveToken(body.token);
  return { token: body.token };
}

// ---------- data ----------

export async function getMe(token: string): Promise<MeResponse> {
  return request<MeResponse>("/api/auth/me", token);
}

/** Push the phone's real screen time to DeepRest (absolute set for today). */
export async function syncScreenTime(
  token: string,
  minutes: number,
  topApps: TopApp[]
): Promise<void> {
  await request("/api/screentime", token, {
    method: "POST",
    body: JSON.stringify({ action: "set", minutes, topApps }),
  });
}
