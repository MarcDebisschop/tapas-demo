// =============================================================================
// server/driverscan/routes.ts  —  NIEUW BESTAND (Werkprotocol Regel 2)
// -----------------------------------------------------------------------------
// De Driver-scan (server-id "tapas-driverscan") meet de 5 Kahler-drivers via
// EXACT dezelfde 10 forced-choice blokken als T4P Business. Scoring gebeurt via
// buildMainScores (server/scoring.ts, ONGEWIJZIGD hergebruikt) — nooit
// gedupliceerd. Deze module raakt geen bestaand rapport- of afnamepad aan.
//
//   GET  /api/driverscan/blocks?taal=nl   → de 10 driver-blokken (forced-choice
//                                            most/least + energie), client-veilig
//   POST /api/driverscan/score            → { responses } → gerangschikte drivers
//   POST /api/driverscan/rapport.pdf      → { responses, naam?, taal? } → PDF
//
// De afname stuurt antwoorden gekeyd "B0".."B9" (blockIndex 0..9), precies zoals
// buildMainScores verwacht.
// =============================================================================
import type { Express, Request, Response } from "express";
import { instrument, kies } from "../instrument";
import { getVraagTekst } from "../question-manager";
import { buildMainScores, type Responses } from "../scoring";
import { renderDriverScanPdf, type DriverScanRow } from "./rapport-pdf";
import { DRIVER_KEYS, veiligeTaal, type DriverKey } from "./duiding";
import { isInstrumentBeschikbaar } from "../instrument-beschikbaarheid";

// Poort: de Driver-scan is pas afneembaar wanneer een prior-beheerder ze heeft
// vrijgegeven (default UIT). Een ingelogde beheerder (adminId in sessie) mag
// ALTIJD, zodat testen mogelijk blijft terwijl de vlag UIT staat. Retourneert
// true wanneer de aanvraag geblokkeerd is (en verstuurt dan de 403).
function driverScanGeblokkeerd(req: Request, res: Response): boolean {
  if (isInstrumentBeschikbaar("tapas-driverscan")) return false;
  if ((req.session as any)?.adminId) return false;
  res.status(403).json({
    error: "De Driver-scan is momenteel niet vrijgegeven. Neem contact op met je begeleider.",
  });
  return true;
}

const TALEN = new Set(["nl", "fr", "en", "es", "ru"]);
const DRIVERKEY_SET = new Set<string>(DRIVER_KEYS);

function kiesTaal(req: Request): string {
  const t = String(req.query.taal ?? "nl").toLowerCase();
  return TALEN.has(t) ? t : "nl";
}

// De 10 forced-choice driver-blokken (family "Drivers") uit het T4P-instrument.
function driverBlokken() {
  return instrument.blocks.filter((b) => b.family === "Drivers");
}

// Client-veilige weergave: item-teksten via de Driver-scan override-laag
// (getVraagTekst("tapas-driverscan", ...)) zodat vraagbeheer-aanpassingen
// live doorwerken; valt terug op de originele T4P-tekst.
function clientBlokken(taal: string) {
  const t = TALEN.has(taal) ? taal : "nl";
  const rs = instrument.responseScales ?? {};
  const energy = rs.energy ?? {};
  const opties = Array.isArray(energy.options) ? energy.options : [];
  return {
    instrumentId: "tapas-driverscan",
    language: t,
    responseScales: {
      energy: {
        min: energy.min,
        max: energy.max,
        options: opties.map((o: any) => ({ value: o.value, label: kies(o.label, t as any) })),
      },
    },
    blocks: driverBlokken().map((b) => ({
      blockIndex: b.blockIndex,
      stateKey: "B" + b.blockIndex,
      family: b.family,
      energyMode: b.energyMode,
      items: b.items.map((it) => ({
        pos: it.pos,
        construct: it.construct,
        text: getVraagTekst("tapas-driverscan", it.id, t, kies(it.text, t as any)),
      })),
    })),
    totalBlocks: driverBlokken().length,
  };
}

// Zuiver de binnenkomende antwoorden tot enkel geldige driver-blokken (B0..B9).
function saneerResponses(raw: any): Responses {
  const out: Responses = {};
  const geldig = new Set(driverBlokken().map((b) => "B" + b.blockIndex));
  if (raw && typeof raw === "object") {
    for (const key of Object.keys(raw)) {
      if (!geldig.has(key)) continue;
      const r = raw[key] ?? {};
      const ie = r.itemEnergy ?? {};
      out[key] = {
        most: r.most ?? null,
        least: r.least ?? null,
        itemEnergy: {
          most: numOrNull(ie.most),
          least: numOrNull(ie.least),
        },
        blockEnergy: numOrNull(r.blockEnergy),
        toelichting: typeof r.toelichting === "string" ? r.toelichting : null,
      };
    }
  }
  return out;
}

function numOrNull(v: any): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// Scoor de driver-rijen via buildMainScores en rangschik sterkst→zwakst op net.
function scoorDrivers(raw: any): DriverScanRow[] {
  const responses = saneerResponses(raw);
  const scores = buildMainScores(responses, 0);
  return scores.constructRows
    .filter((r) => r.family === "Drivers" && DRIVERKEY_SET.has(r.construct))
    .map((r) => ({
      key: r.construct as DriverKey,
      net: r.net,
      avgEnergy: r.avgEnergy,
      toelichting: r.toelichtingen && r.toelichtingen.length ? r.toelichtingen.join(" · ") : null,
    }))
    .sort((a, b) => {
      if (b.net !== a.net) return b.net - a.net;
      return DRIVER_KEYS.indexOf(a.key) - DRIVER_KEYS.indexOf(b.key);
    });
}

export function registerDriverScanRoutes(app: Express): void {
  // De 10 driver-blokken voor de afname.
  app.get("/api/driverscan/blocks", (req: Request, res: Response) => {
    try {
      if (driverScanGeblokkeerd(req, res)) return;
      res.json(clientBlokken(kiesTaal(req)));
    } catch (err) {
      res.status(500).json({
        error: "Kon driver-blokken niet laden",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Scoor de antwoorden → gerangschikte drivers (net + avgEnergy).
  app.post("/api/driverscan/score", (req: Request, res: Response) => {
    try {
      if (driverScanGeblokkeerd(req, res)) return;
      const drivers = scoorDrivers(req.body?.responses ?? req.body);
      res.json({ drivers });
    } catch (err) {
      res.status(500).json({
        error: "Scoren mislukt",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Genereer het korte visuele PDF-rapport (5 talen).
  app.post("/api/driverscan/rapport.pdf", async (req: Request, res: Response) => {
    try {
      if (driverScanGeblokkeerd(req, res)) return;
      const taal = veiligeTaal(String(req.body?.taal ?? "nl"));
      const drivers = scoorDrivers(req.body?.responses ?? req.body);
      if (drivers.length === 0) {
        return res.status(400).json({ error: "Geen driver-antwoorden ontvangen" });
      }
      const pdf = await renderDriverScanPdf({
        taal,
        naam: typeof req.body?.naam === "string" ? req.body.naam : undefined,
        drivers,
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="driver-scan-${taal}.pdf"`);
      res.setHeader("Content-Length", String(pdf.length));
      res.end(pdf);
    } catch (err) {
      res.status(500).json({
        error: "Rapport-generatie mislukt",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
