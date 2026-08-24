// Toetsen op de grens voor de omvang van JSON-berichten.
//
// Het gebrek dat hiermee gedekt wordt: de bulk-import en het uploaden van een
// kandidaatrapport bij T4Recruitment sturen een bestand als base64 in het
// JSON-bericht. Met de standaardgrens van Express (100 kB) antwoordde de server
// daar met 413 Payload Too Large, zonder dat de gebruiker zag waarom.
//
// De toetsen dekken twee kanten: de wegen die het nodig hebben nemen een groot
// bericht aan, en de overige wegen doen dat juist niet.

import { describe, expect, it } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import {
  GEWONE_BODYGRENS,
  RUIME_BODYGRENS,
  magRuimBericht,
} from "../server/bodygrens";

// ---------------------------------------------------------------------------
// Padherkenning
// ---------------------------------------------------------------------------

describe("magRuimBericht", () => {
  it("herkent het uploaden van een kandidaatrapport bij T4Recruitment", () => {
    expect(magRuimBericht("/api/t4r/sessions/12/candidate/extract")).toBe(true);
    expect(magRuimBericht("/api/t4r/sessions/12/candidate/extract/")).toBe(true);
  });

  it("herkent de twee wegen van de bulk-import", () => {
    expect(magRuimBericht("/api/admin/bulk-import/preview")).toBe(true);
    expect(magRuimBericht("/api/admin/bulk-import/verwerk")).toBe(true);
  });

  it("laat het bewaren van een kandidaatrapport op de gewone grens staan", () => {
    expect(magRuimBericht("/api/t4r/sessions/12/candidate")).toBe(false);
  });

  it("geeft geen ruime grens aan de aanmeldweg of aan het dashboard", () => {
    expect(magRuimBericht("/api/admin/login")).toBe(false);
    expect(magRuimBericht("/api/dashboard/abc123")).toBe(false);
    expect(magRuimBericht("/api/afnames")).toBe(false);
  });

  it("laat zich niet misleiden door een pad dat er enkel op lijkt", () => {
    expect(magRuimBericht("/api/admin/bulk-import/preview/extra")).toBe(false);
    expect(magRuimBericht("/api/t4r/sessions/abc/candidate/extract")).toBe(false);
    expect(magRuimBericht("/verzin/api/admin/bulk-import/preview")).toBe(false);
  });
});

describe("de gekozen grenzen", () => {
  it("houdt de gewone grens bescheiden en de ruime grens ruim", () => {
    expect(GEWONE_BODYGRENS).toBe("1mb");
    expect(RUIME_BODYGRENS).toBe("12mb");
  });
});

// ---------------------------------------------------------------------------
// Dezelfde opzet als server/index.ts, met echte HTTP-verzoeken erdoor
// ---------------------------------------------------------------------------

function bouwApp() {
  const app = express();
  const bewaarRuweBody = (req: any, _res: any, buf: Buffer) => {
    req.rawBody = buf;
  };
  const ruimeJsonLezer = express.json({ limit: RUIME_BODYGRENS, verify: bewaarRuweBody });
  app.use((req, res, next) => {
    if (!magRuimBericht(req.path)) return next();
    return ruimeJsonLezer(req, res, next);
  });
  app.use(express.json({ limit: GEWONE_BODYGRENS, verify: bewaarRuweBody }));
  app.use((req, res) => {
    res.json({ ontvangen: String((req.body as any)?.pdfBase64 ?? "").length });
  });
  return app;
}

async function stuur(server: Server, pad: string, bytes: number) {
  const adres = server.address();
  const poort = typeof adres === "object" && adres ? adres.port : 0;
  const body = JSON.stringify({ pdfBase64: "A".repeat(bytes) });
  const antwoord = await fetch(`http://127.0.0.1:${poort}${pad}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  return { status: antwoord.status, tekst: await antwoord.text() };
}

async function metServer(werk: (server: Server) => Promise<void>) {
  const server = createServer(bouwApp());
  await new Promise<void>((klaar) => server.listen(0, "127.0.0.1", () => klaar()));
  try {
    await werk(server);
  } finally {
    await new Promise<void>((klaar) => server.close(() => klaar()));
  }
}

// ---------------------------------------------------------------------------
// De opzet moet ook werkelijk zo aangesloten zijn
// ---------------------------------------------------------------------------

describe("de aansluiting in de bron", () => {
  it("leest de ruime wegen in server/index.ts voor de gewone lezer", () => {
    const bron = readFileSync(
      new URL("../server/index.ts", import.meta.url),
      "utf8",
    );
    expect(bron).toContain("magRuimBericht");
    expect(bron).toContain("limit: RUIME_BODYGRENS");
    expect(bron).toContain("limit: GEWONE_BODYGRENS");
    // De ruime lezer moet VOOR de gewone staan, anders weigert de gewone het
    // bericht al voordat de ruime aan de beurt komt.
    expect(bron.indexOf("RUIME_BODYGRENS, verify")).toBeLessThan(
      bron.indexOf("limit: GEWONE_BODYGRENS"),
    );
  });

  it("verstuurt de dashboardfoto verkleind in plaats van rauw", () => {
    const bron = readFileSync(
      new URL("../client/src/pages/dashboard.tsx", import.meta.url),
      "utf8",
    );
    expect(bron).toContain("verkleinAfbeeldingNaarDataUrl");
    // De oude weg zette het rauwe leesresultaat rechtstreeks in het bericht.
    expect(bron).not.toContain("fotoUrl: String(reader.result)");
  });
});

describe("een groot bericht door de echte opzet", () => {
  it("neemt een kandidaatrapport van ruim 1,3 MB aan", async () => {
    await metServer(async (server) => {
      const { status, tekst } = await stuur(
        server,
        "/api/t4r/sessions/7/candidate/extract",
        1_400_000,
      );
      expect(status).toBe(200);
      expect(JSON.parse(tekst).ontvangen).toBe(1_400_000);
    });
  });

  it("neemt een bulk-importbestand van 400 kB aan", async () => {
    await metServer(async (server) => {
      const { status } = await stuur(server, "/api/admin/bulk-import/verwerk", 400_000);
      expect(status).toBe(200);
    });
  });

  it("weigert hetzelfde grote bericht op een gewone weg met 413", async () => {
    await metServer(async (server) => {
      const { status } = await stuur(server, "/api/afnames", 1_400_000);
      expect(status).toBe(413);
    });
  });

  it("weigert ook op een ruime weg een bericht boven de ruime grens", async () => {
    await metServer(async (server) => {
      const { status } = await stuur(
        server,
        "/api/t4r/sessions/7/candidate/extract",
        13_000_000,
      );
      expect(status).toBe(413);
    });
  });

  it("laat een gewoon klein bericht ongemoeid", async () => {
    await metServer(async (server) => {
      const { status } = await stuur(server, "/api/afnames", 100);
      expect(status).toBe(200);
    });
  });
});
