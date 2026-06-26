import "dotenv/config";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import session from "express-session";
import MemoryStore from "memorystore";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "node:http";

const app = express();
const httpServer = createServer(app);

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

// Sessie-middleware (voor admin login)
const MStore = MemoryStore(session);
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
  store: new MStore({ checkPeriod: 86400000 }),
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
