// =============================================================================
// server/tekstbeheer-routes.ts - Beheerroutes voor de vaste duidingsteksten
//
// Spiegel van de routes in duiding-manager.ts: enkel prior-beheerders, elke
// wijziging met wie en wanneer, en herstellen naar de brontekst blijft altijd
// mogelijk. De CSV-export van het duidingsbeheer dekt deze rijen al, want ze
// staan in dezelfde tabel.
// =============================================================================

import { type Request, type Response } from "express";
import { storage, db } from "./storage";
import {
  zetTekstDatabank,
  tekstInstrumenten,
  tekstOverzicht,
  bewaarTekst,
  wisTekst,
  tekstLog,
  isTekstInstrument,
} from "./duidingstekst-register";

async function requirePrior(req: Request, res: Response, next: Function) {
  const adminId = (req.session as any)?.adminId;
  if (!adminId) return res.status(401).json({ error: "Niet ingelogd." });
  const beheerder = await storage.getBeheerder(Number(adminId));
  if (!beheerder || !beheerder.isPrior) {
    return res.status(403).json({ error: "Enkel prior-beheerders kunnen de teksten beheren." });
  }
  (req as any).beheerder = beheerder;
  next();
}

export function buildTekstbeheerRoutes(app: any) {
  // De databank wordt hier ingebracht, zodat het register zelf niets van de
  // opslaglaag hoeft te importeren (geen kringverwijzing met de motoren).
  // Drizzle houdt de sqlite-verbinding onder $client; oudere versies onder _db.
  // Beide worden gelezen, zodat het register de echte databank vindt.
  zetTekstDatabank(() => (db as any).$client ?? (db as any)._db ?? (storage as any).sqlite ?? null);

  app.get("/api/admin/tekstbeheer/instrumenten", requirePrior, async (_req: Request, res: Response) => {
    res.json({ instrumenten: tekstInstrumenten() });
  });

  // Eerst geregistreerd: een vast segment, zodat het niet als taal matcht. De
  // sleutel gaat als query mee, want een constructnaam kan een schuine streep
  // bevatten (Complexiteit/Conceptueel).
  app.get("/api/admin/tekstbeheer/:instrument/veldlog", requirePrior, async (req: Request, res: Response) => {
    const { instrument } = req.params as { instrument: string };
    const sleutel = String(req.query.sleutel ?? "");
    if (!isTekstInstrument(instrument)) return res.status(404).json({ error: "Onbekend instrument." });
    if (!sleutel) return res.status(400).json({ error: "sleutel is verplicht." });
    res.json({ instrument, sleutel, log: tekstLog(instrument, sleutel) });
  });

  app.get("/api/admin/tekstbeheer/:instrument/:taal", requirePrior, async (req: Request, res: Response) => {
    const { instrument, taal } = req.params as { instrument: string; taal: string };
    if (!isTekstInstrument(instrument)) return res.status(404).json({ error: "Onbekend instrument." });
    res.json(tekstOverzicht(instrument, taal));
  });

  app.put("/api/admin/tekstbeheer/:instrument/:taal", requirePrior, async (req: Request, res: Response) => {
    const { instrument, taal } = req.params as { instrument: string; taal: string };
    const { sleutel, tekst } = req.body as { sleutel?: string; tekst?: string };
    const beheerder = (req as any).beheerder;
    if (!sleutel) return res.status(400).json({ error: "sleutel is verplicht." });
    const r = bewaarTekst(instrument, sleutel, taal, String(tekst ?? ""), beheerder.email);
    if (!r.ok) return res.status(r.fout === "Onbekend instrument." || r.fout === "Onbekende tekstsleutel." ? 404 : 400).json({ error: r.fout });
    res.json({ ok: true, instrument, taal, sleutel });
  });

  app.delete("/api/admin/tekstbeheer/:instrument/:taal", requirePrior, async (req: Request, res: Response) => {
    const { instrument, taal } = req.params as { instrument: string; taal: string };
    const sleutel = String((req.query.sleutel ?? (req.body as any)?.sleutel) ?? "");
    if (!sleutel) return res.status(400).json({ error: "sleutel is verplicht." });
    const r = wisTekst(instrument, sleutel, taal);
    if (!r.ok) return res.status(404).json({ error: r.fout });
    res.json({ ok: true, instrument, taal, sleutel });
  });
}
