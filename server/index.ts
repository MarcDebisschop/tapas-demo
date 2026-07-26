import "dotenv/config";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import session from "express-session";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import betterSqlite3SessionStore from "better-sqlite3-session-store";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { sqlite } from "./storage";
import { createServer } from "node:http";

const app = express();
const httpServer = createServer(app);

// A3 — SESSION_SECRET fail-fast in productie. In productie mag de app NOOIT met
// een hardgecodeerde fallback-secret draaien; dat zou sessies vervalsbaar maken.
if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET ontbreekt in productie. Zet de omgevingsvariabele SESSION_SECRET voordat je de app start.",
  );
}
if (!process.env.SESSION_SECRET) {
  console.warn(
    "[tapas] WAARSCHUWING: SESSION_SECRET niet gezet — hardgecodeerde fallback wordt gebruikt (enkel voor niet-productie).",
  );
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// A4 — Security-hardening via helmet. CSP is BEWUST uitgeschakeld: de bestaande
// Vite/React-frontend en assets (incl. inline styles/scripts en cross-origin
// laden via de pplx.app-proxy) draaien zonder CSP. Een te strikte CSP zou de
// frontend breken; liever geen CSP dan een brekende CSP. Cross-origin
// resource/embedder policies staan ruim zodat de cross-origin cookie-/asset-
// flow via de proxy blijft werken.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
  }),
);

// A4 — Ruime rate-limiting op auth-/token-endpoints (login, wachtwoord-,
// token- en magic-link-endpoints). Limieten zijn zo gekozen dat normaal gebruik
// niet gehinderd wordt; enkel brute-force valt op. `trust proxy` staat al op 1
// (hieronder), zodat het echte client-IP achter de pplx.app-proxy telt.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Te veel pogingen. Probeer het over enkele minuten opnieuw." },
});
app.use(
  [
    "/api/admin/login",
    "/api/admin/wachtwoord",
    "/api/coach/login",
    "/api/deelnemers/login",
    "/api/deelnemers/token-login",
    "/api/deelnemers/magic",
    "/api/organisatie/login",
  ],
  authLimiter,
);

// Sessie-middleware (voor admin login)
// A2 — SQLite-backed session store i.p.v. MemoryStore, op dezelfde better-sqlite3
// DB als de app (via de gedeelde `sqlite`-instantie uit storage.ts). Zo blijven
// sessies bewaard over herstarts heen. De cookie-config blijft ONGEWIJZIGD.
const SqliteStore = betterSqlite3SessionStore(session);
// Op pplx.app loopt het verkeer via een HTTPS-proxy (X-Forwarded-Proto: https).
// trust proxy = 1 zodat req.secure correct werkt achter de proxy.
// KRITIEK: pplx.app proxy strip cookies zonder __Host- prefix.
// KRITIEK: SameSite=None vereist voor cross-origin POST (S3-frontend → sandbox-backend).
//          SameSite=None vereist Secure=true → alleen in productie (HTTPS).
app.set("trust proxy", 1);
// KRITIEK pplx.app cookie-regels:
// 1. Cookie naam MOET __Host- prefix hebben (pplx.app proxy strip andere cookies).
// 2. SameSite=None vereist voor cross-origin POST (S3-frontend → /port/5000 sandbox).
// 3. secure: "auto" = express-session gebruikt req.secure (werkt correct achter
//    pplx.app HTTPS-proxy via trust proxy: 1 + X-Forwarded-Proto: https).
// 4. credentials: "include" staat in queryClient.ts zodat de browser de cookie meestuurt.
app.use(session({
  secret: process.env.SESSION_SECRET || "tapas-demo-secret-2026",
  resave: false,
  saveUninitialized: false,
  name: "__Host-tapas-sid",
  store: new SqliteStore({ client: sqlite, expired: { clear: true, intervalMs: 24 * 60 * 60 * 1000 } }),
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    // sameSite: "auto" → op HTTPS (pplx.app): "none" (cross-origin OK)
    //                  → op HTTP (lokaal dev): "lax" (veilig)
    // secure: "auto"  → op HTTPS: true → vereist voor __Host- prefix + SameSite=None
    //                  → op HTTP: false → werkt lokaal
    sameSite: "auto",
    secure: "auto",
    path: "/",
  },
}));

// ---------------------------------------------------------------------------
// Demo-vervaldatum (tijdslot-beveiliging voor derden)
// ---------------------------------------------------------------------------
// Zet DEMO_EXPIRES als env var op Render, bv: 2026-08-01T23:59:00+02:00
// - Niet gezet / leeg  -> demo altijd open (geen slot).
// - Gezet & verstreken -> bezoekers krijgen een net "demo verlopen"-scherm (410).
// Verzet de datum later ZONDER redeploy: pas DEMO_EXPIRES aan in Render en
// klik "Restart service". Geen code-wijziging of rebuild nodig.
//
// Uitzonderingen (blijven altijd bereikbaar, ook na verval):
//   1. Admins met een actieve sessie (req.session.adminId) -> volledige toegang.
//   2. /api/admin/*  -> zodat een admin ook NA verval nog kan inloggen.
//   3. /assets/*, favicon e.d. -> zodat de login-UI kan laden.
const _demoExpiresRaw = (process.env.DEMO_EXPIRES || "").trim();
const _demoExpiresAt = _demoExpiresRaw ? new Date(_demoExpiresRaw) : null;
const _demoExpiresValid = _demoExpiresAt && !Number.isNaN(_demoExpiresAt.getTime());

function _demoVervalPagina(vervalIso: string): string {
  const datum = new Date(vervalIso).toLocaleString("nl-BE", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Brussels",
  });
  return `<!doctype html><html lang="nl"><head><meta charset="UTF-8"/>` +
    `<meta name="viewport" content="width=device-width, initial-scale=1"/>` +
    `<title>Demo verlopen — TaPas</title>` +
    `<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;` +
    `align-items:center;justify-content:center;background:#0b0f17;color:#e6e9ef;` +
    `font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px}` +
    `.kaart{max-width:520px;text-align:center;background:#131926;border:1px solid #1f2937;` +
    `border-radius:16px;padding:40px 32px}h1{font-size:1.5rem;margin:0 0 12px}` +
    `p{color:#9aa4b2;line-height:1.6;margin:0 0 8px}.klein{font-size:.85rem;color:#6b7280;` +
    `margin-top:20px}</style></head><body><div class="kaart">` +
    `<h1>Deze demo is niet langer beschikbaar</h1>` +
    `<p>De demoperiode is verstreken op <strong>${datum}</strong>.</p>` +
    `<p>Neem gerust contact op met TaPasCity voor een nieuwe toegang.</p>` +
    `<p class="klein">TaPas — één platform voor inzicht in mens &amp; team</p>` +
    `</div></body></html>`;
}

app.use((req, res, next) => {
  // Geen geldige vervaldatum ingesteld -> alles open.
  if (!_demoExpiresValid) return next();
  // Nog niet verstreken -> alles open.
  if (Date.now() <= (_demoExpiresAt as Date).getTime()) return next();

  // Vanaf hier: demo is verstreken.
  // 1. Admin met actieve sessie mag altijd door.
  if ((req.session as any)?.adminId) return next();
  // 2. Admin-API blijft open zodat inloggen na verval mogelijk is.
  if (req.path.startsWith("/api/admin")) return next();
  // 3. Statische assets blijven open zodat de login-UI kan laden.
  if (
    req.path.startsWith("/assets") ||
    req.path === "/favicon.png" ||
    req.path === "/favicon.ico"
  ) {
    return next();
  }

  // Alle overige bezoekers: nette vervalpagina.
  res.status(410).type("html").send(_demoVervalPagina(_demoExpiresRaw));
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  // Host-selectie:
  //   pplx.app sandbox: proxy bezet 0.0.0.0:5000 → server MOET op 127.0.0.1 binden.
  //   Render / lokale dev / elk ander platform: server MOET op 0.0.0.0 binden
  //   zodat de load balancer van buiten kan bereiken.
  // PPLX_SANDBOX=true wordt gezet in de pplx.app omgeving (via publish_website).
  // Op Render en lokaal is die variabele afwezig → 0.0.0.0.
  const host = process.env.PPLX_SANDBOX === "true" ? "127.0.0.1" : "0.0.0.0";
  httpServer.listen(
    {
      port,
      host,
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
