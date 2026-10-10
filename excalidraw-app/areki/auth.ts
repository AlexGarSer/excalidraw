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

// Sibling sites behind the same login (e.g. vault.areki.mx) send the user to
// /login?next=<absolute url>. Only follow it to https pages of the dashboard's
// parent domain, never to an arbitrary site (open redirect).
export const getExternalNext = (search: string, currentHost: string) => {
  const next = new URLSearchParams(search).get("next");
  if (!next) {
    return null;
  }
  try {
    const url = new URL(next);
    const parent = currentHost.split(".").slice(-2).join(".");
    const allowed =
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      (url.hostname === parent || url.hostname.endsWith(`.${parent}`));
    return allowed ? url.href : null;
  } catch {
    return null;
  }
};
