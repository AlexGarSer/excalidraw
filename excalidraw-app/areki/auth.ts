// All requests go through the same origin; nginx proxies /api/* to the backend.
const API_BASE = "/api";

export type Session = { username: string };

export const fetchSession = async (): Promise<Session | null> => {
  try {
    const response = await fetch(`${API_BASE}/me`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
};

export const login = async (
  username: string,
  password: string,
): Promise<{ ok: true } | { ok: false; message: string }> => {
  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (response.ok) {
      return { ok: true };
    }
    const data = await response.json().catch(() => null);
    return { ok: false, message: data?.message || "Login failed" };
  } catch {
    return { ok: false, message: "Could not reach the server" };
  }
};

export const logout = async () => {
  try {
    await fetch(`${API_BASE}/logout`, {
      method: "POST",
      credentials: "same-origin",
    });
  } finally {
    window.location.assign("/login");
  }
};
