import "dotenv/config";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import session from "express-session";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { SessieOpslag } from "./sessie-opslag";
import { AANMELD_VERSIE } from "./admin-guard";
import { registerRoutes } from "./routes";
import { csrfBescherming } from "./csrf-bescherming";
import { serveStatic } from "./static";
import { sqlite } from "./storage";
import { logEncryptieStatus } from "./db-encryptie";
import { meldDemoModusBijOpstart } from "./demomodus";
import { meldBelevingsmodusBijOpstart } from "./belevingsmodus";
import {
  VOORBEELDDOSSIER_TRAJECTNAAM,
  beschrijfVoorbeelddossier,
  meldVoorbeelddossierBijOpstart,
} from "./voorbeelddossier";
import { bepaalSessieCookieNaam } from "./sessie-cookie";
import { VERSIE, COMMIT, BOUWDATUM, BRON } from "./versie";
import { createServer } from "node:http";
import { GEWONE_BODYGRENS, RUIME_BODYGRENS, magRuimBericht } from "./bodygrens";

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

// De wegen die een bestand als base64 ontvangen worden eerst gelezen, met een
// ruime grens. Wie hier langs komt heeft daarna al een req.body, waardoor de
// gewone lezer hieronder niets meer doet. Zie server/bodygrens.ts voor de
// afweging waarom de ruime grens niet voor het hele platform geldt.
const bewaarRuweBody = (req: Request, _res: Response, buf: Buffer) => {
  req.rawBody = buf;
};
const ruimeJsonLezer = express.json({ limit: RUIME_BODYGRENS, verify: bewaarRuweBody });
app.use((req, res, next) => {
  if (!magRuimBericht(req.path)) return next();
  return ruimeJsonLezer(req, res, next);
});

app.use(
  express.json({
    limit: GEWONE_BODYGRENS,
    verify: bewaarRuweBody,
  }),
);

app.use(express.urlencoded({ extended: false }));

// A4 / S-2 (audit) — Security-hardening via helmet.
//
// Tot ronde 4 stond het inhoudsbeleid voor de browser (Content Security Policy)
// volledig uit, met als reden dat een te strikt beleid de bestaande
// Vite/React-frontend zou breken. Die vrees is terecht, maar "helemaal uit" laat
// ook geen enkel spoor na. Daarom staat het beleid nu in MELDMODUS
// (report-only): de browser handhaaft niets en breekt dus niets, maar meldt elke
// overtreding aan /api/csp-melding. Zo wordt in de praktijk meetbaar wat een
// handhavend beleid zou blokkeren, en is de stap naar handhaving een beslissing
// op cijfers in plaats van op vermoedens.
//
// Zet TAPAS_CSP=handhaven om het beleid wél te laten handhaven (aanbevolen zodra
// het meldlogboek een tijd stil blijft). Zet TAPAS_CSP=uit om het volledig uit te
// schakelen, bijvoorbeeld om een probleem uit te sluiten.
//
// Cross-origin resource/embedder policies staan ruim zodat de cross-origin
// cookie-/asset-flow via de proxy blijft werken.
const cspStand = (process.env.TAPAS_CSP ?? "melden").trim().toLowerCase();
const cspRichtlijnen = {
  defaultSrc: ["'self'"],
  // De frontend is een Vite/React-bundel met inline stijlen; die moeten toegelaten
  // blijven, anders is het beleid meteen onbruikbaar.
  scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
  imgSrc: ["'self'", "data:", "blob:", "https:"],
  mediaSrc: ["'self'", "data:", "blob:"],
  connectSrc: ["'self'", "https:", "wss:"],
  frameAncestors: ["'self'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  reportUri: ["/api/csp-melding"],
} as const;
app.use(
  helmet({
    contentSecurityPolicy:
      cspStand === "uit"
        ? false
        : {
            useDefaults: false,
            directives: cspRichtlijnen as unknown as Record<string, string[]>,
            reportOnly: cspStand !== "handhaven",
          },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
  }),
);

// S-2 — Ontvangstpunt voor de meldingen van de browser. Bewust klein gehouden:
// het logt beknopt welke richtlijn overtreden werd en op welke pagina, en nooit
// de inhoud van de pagina zelf. Antwoord is altijd 204, zodat de browser niets
// hoeft te verwerken.
app.post(
  "/api/csp-melding",
  express.json({ type: ["application/csp-report", "application/json"], limit: "16kb" }),
  (req: Request, res: Response) => {
    const m = (req.body ?? {}) as Record<string, any>;
    const r = m["csp-report"] ?? m;
    console.warn(
      "[csp-melding] richtlijn=%s geblokkeerd=%s pagina=%s",
      r?.["violated-directive"] ?? r?.effectiveDirective ?? "onbekend",
      r?.["blocked-uri"] ?? r?.blockedURL ?? "onbekend",
      r?.["document-uri"] ?? r?.documentURL ?? "onbekend",
    );
    res.status(204).end();
  },
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

// K-1 (audit, tweede ronde) — Het koppelpad van het eindscherm en het afrond-
// pad van deel 2 zijn de twee routes waar een onraadbaar bezitsbewijs of een
// oplopend afname-id de toegang bepaalt. Voor die twee is de ruime auth-limiet
// (50 per 15 min) te los: ze zou een aanvaller 50 gokpogingen per kwartier per
// IP geven. Daarom een eigen, strengere begrenzer. Een echte deelnemer raakt
// deze paden hoogstens enkele keren aan, dus 10 per kwartier hindert niemand.
const koppelLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Te veel pogingen. Probeer het over enkele minuten opnieuw." },
});
app.use(["/api/afnames/:id/koppel-dashboard", "/api/afnames/:id/connection"], koppelLimiter);

// S-5 (audit) — De dashboards van deelnemers, atleten en respondenten zijn enkel
// beschermd door een token in de URL. Dat is een aanvaardbaar ontwerp voor een
// persoonlijke link, maar zonder begrenzing kan iemand ongelimiteerd tokens
// uitproberen. Deze begrenzer is ruim genoeg voor echt gebruik - een deelnemer
// klikt binnen een kwartier makkelijk enkele tientallen keren in zijn dashboard -
// en smoort systematisch proberen wel af.
const tokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Te veel verzoeken. Probeer het over enkele minuten opnieuw." },
});
app.use(
  [
    "/api/dashboard/:token",
    "/api/t4sports/dashboard/:token",
    "/api/teamscan/deelnemer/:token",
    "/api/t4o/respondent/:token",
    "/api/uitnodigingen/:token",
    "/api/r/:token",
    "/api/skin/:token",
  ],
  tokenLimiter,
);

// H-2 (audit) — Bescherming tegen cross-site request forgery via
// oorsprongverificatie op statuswijzigende verzoeken. Staat bewust VOOR de
// sessiemiddleware: een geweigerd verzoek raakt de sessieopslag niet. Zie
// server/csrf-bescherming.ts voor de volledige verantwoording en de
// omgevingsvariabelen TAPAS_TOEGESTANE_ORIGINS en TAPAS_CSRF_STRIKT.
app.use(csrfBescherming);

// Sessie-middleware (voor admin login)
// A2 — SQLite-backed session store i.p.v. MemoryStore, op dezelfde better-sqlite3
// DB als de app (via de gedeelde `sqlite`-instantie uit storage.ts). Zo blijven
// sessies bewaard over herstarts heen. De cookie-config blijft ONGEWIJZIGD.
// L-1 (audit): de opslag is eigen code (server/sessie-opslag.ts) i.p.v. het
// GPL-3.0-pakket better-sqlite3-session-store. Zelfde tabel `sessions`, dus
// bestaande sessies lopen ongewijzigd door.
// Op pplx.app loopt het verkeer via een HTTPS-proxy (X-Forwarded-Proto: https).
// trust proxy = 1 zodat req.secure correct werkt achter de proxy.
// KRITIEK: pplx.app proxy strip cookies zonder __Host- prefix.
// KRITIEK: SameSite=None vereist voor cross-origin POST (S3-frontend → sandbox-backend).
//          SameSite=None vereist Secure=true → alleen in productie (HTTPS).
app.set("trust proxy", 1);
// KRITIEK pplx.app cookie-regels:
// 1. Cookie naam MOET __Host- prefix hebben op elke omgeving die effectief
//    over HTTPS loopt (pplx.app proxy strip andere cookies, en __Host- is
//    sowieso de veiligste keuze zodra Secure gegarandeerd aan staat).
// 2. SameSite=None vereist voor cross-origin POST (S3-frontend → sandbox-backend).
// 3. secure: "auto" = express-session gebruikt req.secure (werkt correct achter
//    pplx.app HTTPS-proxy via trust proxy: 1 + X-Forwarded-Proto: https).
// 4. credentials: "include" staat in queryClient.ts zodat de browser de cookie meestuurt.
//
// Punt C (verslag-t4teens-doorloop.md, Gebrek 1): __Host- is geen decoratie,
// het is een door de browser afgedwongen voorvoegsel. Een cookie met die naam
// wordt door elke standaardconforme browser/http-client geweigerd zodra hij
// niet ALTIJD de Secure-vlag draagt, ongeacht wat secure: "auto" er op dat
// moment van maakt. Op een gewone (niet-HTTPS) verbinding gaf secure: "auto"
// terecht secure=false, maar de naam bleef __Host-, dus het cookie werd nooit
// gezet en aanmelden was onmogelijk op elke niet-HTTPS-omgeving (lokale
// ontwikkeling, of eender welke installatie zonder eigen HTTPS-terminatie).
//
// Oplossing: het __Host- voorvoegsel wordt enkel gebruikt op de omgevingen
// waarvan we bij het opstarten al zeker weten dat ze altijd over HTTPS lopen
// (productie op Render, of de pplx.app-sandbox die zelf een HTTPS-proxy
// ervoor zet). Overal elders (lokale dev, tests) heet de cookie gewoon
// "tapas-sid", zonder voorvoegseleisen, maar met exact dezelfde
// secure/sameSite/httpOnly-instellingen als voorheen. Dit verzwakt de
// productieomgeving niet: daar blijft de naam, de Secure-vlag en
// SameSite=None precies zoals ze waren.
const _sessieCookieNaam = bepaalSessieCookieNaam(process.env);
app.use(session({
  secret: process.env.SESSION_SECRET || "tapas-demo-secret-2026",
  resave: false,
  saveUninitialized: false,
  name: _sessieCookieNaam,
  store: new SessieOpslag({ client: sqlite, ruimVerlopenOp: true, opruimIntervalMs: 24 * 60 * 60 * 1000 }),
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    // sameSite: "auto" → op HTTPS (pplx.app/productie): "none" (cross-origin OK)
    //                  → op HTTP (lokaal dev): "lax" (veilig)
    // secure: "auto"  → op HTTPS: true → vereist voor __Host- prefix + SameSite=None
    //                  → op HTTP: false → werkt lokaal
    // Dit zijn geldige runtime-waarden voor express-session (zie
    // node_modules/express-session/index.js: cookieOptions.secure/sameSite
    // === "auto" wordt per request opgelost), ook al kent het type-pakket
    // @types/express-session enkel "auto" voor `secure`, niet voor
    // `sameSite`. Vandaar de expliciete cast hieronder voor de typecontrole.
    sameSite: "auto" as unknown as "lax",
    secure: "auto",
    path: "/",
  },
}));

// ---------------------------------------------------------------------------
// Oude beheerderssessies vervallen
// ---------------------------------------------------------------------------
// Er is een tijd geweest waarin de beheeromgeving zonder wachtwoord binnenliet.
// Elke sessie uit die tijd bleef 24 uur geldig, dus wachtwoord vragen bij de
// deur haalde niets uit zolang die sessies bleven werken. Een sessie draagt nu
// een aanmeldversie; ontbreekt die of klopt ze niet, dan wordt de
// beheerdersidentiteit hier weggehaald voordat enige route ze kan lezen. Zo
// hoeft niet elke afzonderlijke lezer van req.session.adminId aangepast te
// worden.
app.use((req, _res, next) => {
  const sessie = req.session as any;
  if (sessie?.adminId != null && Number(sessie.aanmeldVersie) !== AANMELD_VERSIE) {
    sessie.adminId = undefined;
    sessie.aanmeldVersie = undefined;
  }
  next();
});

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

// Verzoeklogger. S-1 (audit, AVG-dataminimalisatie): de volledige antwoordinhoud
// werd meegeschreven naar het logboek, inclusief namen, e-mailadressen en
// volledige profielinhoud. Het logboek bevat vanaf nu enkel metadata over het
// verzoek: methode, pad, statuscode en duur. Antwoordinhoud wordt NOOIT gelogd.
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

// Auditbevinding O-1/O-2 (operationele laag): er was geen enkel endpoint waarmee
// een uptime- of platformmonitor kon vaststellen of het platform leeft en of de
// databank bereikbaar is. Dit endpoint doet exact dat en niets meer: het geeft
// geen persoonsgegevens, geen configuratie en geen padinformatie prijs. Bij een
// onbereikbare databank antwoordt het met 503, zodat een monitor de storing ziet
// in plaats van een schijnbaar gezonde webserver.
const opgestartOp = Date.now();
app.get("/api/gezondheid", (_req, res) => {
  const antwoord = {
    status: "ok" as "ok" | "degraded",
    versie: VERSIE,
    commit: COMMIT,
    bouwdatum: BOUWDATUM,
    bron: BRON,
    uptimeSeconden: Math.round((Date.now() - opgestartOp) / 1000),
    databank: "ok" as "ok" | "onbereikbaar",
    // Twee ja-of-nee-antwoorden waarmee van buitenaf te zien is waarom de
    // Regiekamer eventueel leeg blijft: vraagt deze omgeving om een
    // voorbeelddossier, en staat dat dossier er ook echt. Geen aantallen en
    // geen namen, dus nog steeds niets over mensen of over de opstelling.
    voorbeelddossier: beschrijfVoorbeelddossier(() =>
      Number(
        (
          sqlite
            .prepare("select count(*) as aantal from traject where naam = ?")
            .get(VOORBEELDDOSSIER_TRAJECTNAAM) as { aantal: number }
        ).aantal,
      ),
    ),
  };
  try {
    sqlite.prepare("select 1").get();
  } catch {
    antwoord.status = "degraded";
    antwoord.databank = "onbereikbaar";
  }
  res.status(antwoord.status === "ok" ? 200 : 503).json(antwoord);
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
      // FIX 6 (AVG art. 32): meld hier, en niet bij het openen van de databank,
      // of encryptie-at-rest actief is. Op dit punt zijn alle modules geladen die
      // zelf een databank-handle openen, dus telt de melding ze allemaal mee.
      // Bewust luidruchtig: draait de hook als no-op, dan hoort dat in het log te
      // staan in plaats van stil aangenomen te worden.
      logEncryptieStatus();
      // S-4 (audit): maak in hetzelfde opstartlogboek zichtbaar of de demomodus
      // geldt en dus of wachtwoorden afgedwongen worden. In productie is de
      // demomodus onmogelijk; staat de schakelaar er toch, dan zegt de melding dat.
      meldDemoModusBijOpstart();
      // Zelfde reden, voor de tweede deur: maak zichtbaar of
      // POST /api/deelnemers/login bestaat. Die route geeft een dashboardtoken
      // op basis van een e-mailadres alleen; in productie bestaat ze niet.
      meldBelevingsmodusBijOpstart();
      meldVoorbeelddossierBijOpstart();
    },
  );
})();
