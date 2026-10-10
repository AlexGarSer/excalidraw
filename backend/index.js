const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");

const PORT = Number(process.env.PORT || 3001);
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;
const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS || 12);
// Set COOKIE_SECURE=false only for local testing over plain http
const COOKIE_SECURE = process.env.COOKIE_SECURE !== "false";
// Share the session with sibling sites (vault.areki.mx) by scoping the cookie
// to the parent domain, e.g. COOKIE_DOMAIN=.areki.mx. Unset = this host only.
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;
// Excalidraw scenes (index.json + <id>.excalidraw). Mounted read-only from the
// host, kept out of git: the repository is public.
const ESCENAS_DIR = path.resolve(
  process.env.ESCENAS_DIR || path.join(__dirname, "escenas"),
);
// Archify maps (index.json + <id>.html), same deployment as the scenes
const MAPAS_DIR = path.resolve(
  process.env.MAPAS_DIR || path.join(__dirname, "mapas"),
);

const COOKIE_NAME = "areki_session";
const SESSION_TTL_MS = SESSION_TTL_HOURS * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 10;
const FAILED_ATTEMPTS_WINDOW_MS = 15 * 60 * 1000;

if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
  console.error("ADMIN_USERNAME and ADMIN_PASSWORD must be set");
  process.exit(1);
}
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  console.error("SESSION_SECRET must be set (at least 32 characters)");
  process.exit(1);
}

// -----------------------------------------------------------------------------
// session token: base64url(payload).base64url(hmac-sha256(payload))
// -----------------------------------------------------------------------------

const sign = (value) =>
  crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");

// constant-time comparison that also hides length differences
const safeEqual = (a, b) => {
  const hashA = crypto.createHash("sha256").update(String(a)).digest();
  const hashB = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
};

const createSessionToken = (username) => {
  const payload = Buffer.from(
    JSON.stringify({ u: username, exp: Date.now() + SESSION_TTL_MS }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
};

const verifySessionToken = (token) => {
  if (typeof token !== "string") {
    return null;
  }
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.exp !== "number" || data.exp < Date.now()) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

const getCookie = (req, name) => {
  const header = req.headers.cookie;
  if (!header) {
    return null;
  }
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
};

const cookieOptions = {
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: "strict",
  path: "/",
  domain: COOKIE_DOMAIN,
};

// -----------------------------------------------------------------------------
// brute-force protection (in-memory, per client IP)
// -----------------------------------------------------------------------------

const failedAttempts = new Map();

const isRateLimited = (ip) => {
  const entry = failedAttempts.get(ip);
  if (!entry) {
    return false;
  }
  if (Date.now() - entry.firstAttempt > FAILED_ATTEMPTS_WINDOW_MS) {
    failedAttempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILED_ATTEMPTS;
};

const registerFailedAttempt = (ip) => {
  const entry = failedAttempts.get(ip);
  if (!entry || Date.now() - entry.firstAttempt > FAILED_ATTEMPTS_WINDOW_MS) {
    failedAttempts.set(ip, { count: 1, firstAttempt: Date.now() });
  } else {
    entry.count++;
  }
};

// -----------------------------------------------------------------------------
// app
// -----------------------------------------------------------------------------

const app = express();

// requests arrive through the nginx proxies (host + frontend container)
app.set("trust proxy", ["loopback", "uniquelocal"]);
app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));

// use on any route that serves protected data
const requireSession = (req, res, next) => {
  const session = verifySessionToken(getCookie(req, COOKIE_NAME));
  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  req.session = session;
  next();
};

app.post("/login", (req, res) => {
  const ip = req.ip;
  if (isRateLimited(ip)) {
    return res
      .status(429)
      .json({ message: "Too many failed attempts, try again later" });
  }

  const { username, password } = req.body || {};
  // evaluate both comparisons to avoid leaking which one failed
  const validUser = safeEqual(username ?? "", ADMIN_USERNAME);
  const validPassword = safeEqual(password ?? "", ADMIN_PASSWORD);

  if (!validUser || !validPassword) {
    registerFailedAttempt(ip);
    return res.status(401).json({ message: "Invalid credentials" });
  }

  failedAttempts.delete(ip);
  res.cookie(COOKIE_NAME, createSessionToken(ADMIN_USERNAME), {
    ...cookieOptions,
    maxAge: SESSION_TTL_MS,
  });
  res.json({ username: ADMIN_USERNAME });
});

app.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions);
  if (COOKIE_DOMAIN) {
    // also drop a host-only cookie issued before COOKIE_DOMAIN was set
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, domain: undefined });
  }
  res.status(204).end();
});

app.get("/me", requireSession, (req, res) => {
  res.json({ username: req.session.u });
});

// read-only catalog of files uploaded to the server: GET <route> returns
// index.json, GET <route>/:id returns <id><extension>
const serveCatalog = (route, dir, extension, headers) => {
  app.get(route, requireSession, (req, res) => {
    fs.readFile(path.join(dir, "index.json"), "utf8", (err, data) => {
      if (err) {
        // nothing uploaded yet
        return res.json([]);
      }
      res.set("Cache-Control", "no-store").type("json").send(data);
    });
  });

  app.get(`${route}/:id`, requireSession, (req, res) => {
    const { id } = req.params;
    // ids are short slugs such as "04a"; never let them form a path
    if (!/^[0-9a-z_-]{1,64}$/i.test(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    res.set("Cache-Control", "no-store");
    res.sendFile(`${id}${extension}`, { root: dir, headers }, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ message: "Not found" });
      }
    });
  });
};

serveCatalog("/escenas", ESCENAS_DIR, ".excalidraw", {
  "Content-Type": "application/json",
});

// Archify maps are standalone HTML with inline scripts. Sandbox them (opaque
// origin, no access to the session or the parent page) and forbid any
// network access, even when opened directly instead of in the iframe.
serveCatalog("/mapas", MAPAS_DIR, ".html", {
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": [
    "sandbox allow-scripts allow-downloads",
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    "font-src data:",
    "media-src blob:",
    "frame-ancestors 'self'",
  ].join("; "),
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Areki Backend listening on port ${PORT}`);
});
