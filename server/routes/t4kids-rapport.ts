/**
 * server/routes/t4kids-rapport.ts — NIEUW BESTAND (strikt additief).
 *
 * Publieke, T4Kids-eigen leesroute voor het rijke kindrapport:
 *   GET /api/afnames/:id/t4kids-rapport.json
 *
 * Geeft het reeds server-side gebouwde generator-contract terug (identiek aan
 * wat buildT4KidsContract produceerde en in afname.generatorContract staat
 * opgeslagen), maar UITSLUITEND als de afname instrumentId === "t4kids" heeft.
 * Zo hoeft de kind-eindpagina (client/src/pages/t4kids-rapport.tsx) geen admin-
 * sessie te hebben. Geen enkel ander instrument raakt hierdoor aan: andere
 * instrumenten krijgen 404.
 *
 * BEZITSBEWIJS (toegevoegd na de functionele test van augustus 2026)
 * Deze route stond volledig open: wie het oplopende afname-id gokte, kon het
 * volledige rapport van een kind lezen, met naam, keuzes en eigen woorden. Nu
 * staat dezelfde poortwachter ervoor als op de inleverroutes
 * (server/afname-bewijs.ts). De webclient stuurt het bewijs automatisch mee op
 * elk /api/afnames/:id/...-pad (client/src/lib/afname-bewijs.ts), dus de
 * kind-eindpagina en de afdrukweg blijven ongewijzigd werken; een beheerder mag
 * altijd door. Zonder geldig bewijs volgt 404, dezelfde tekst als bij een
 * onbestaande afname, zodat het antwoord niet verklapt of het id bestaat.
 *
 * Er is bewust GEEN server-side PDF-route: het rapport is beeld- en grafiek-rijk
 * (aardappelillustraties + recharts). De "Download als PDF"-knop gebruikt de
 * browser-print (window.print) met een print-stylesheet — de betrouwbaarste weg
 * om exact dezelfde rijke lay-out netjes op A4 te pagineren.
 */

import type { Express } from "express";
import { storage } from "../storage";
import { vereisAfnameBewijs } from "../afname-bewijs";

export function registerT4KidsRapportRoutes(app: Express): void {
  app.get("/api/afnames/:id/t4kids-rapport.json", vereisAfnameBewijs, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Ongeldige afname-id" });
    }
    const a = await storage.getAfname(id);
    if (!a || a.instrumentId !== "t4kids") {
      return res.status(404).json({ error: "Geen T4Kids-rapport gevonden" });
    }
    if (!a.generatorContract) {
      return res.status(404).json({ error: "Rapport nog niet beschikbaar" });
    }
    let contract: unknown;
    try {
      contract = JSON.parse(a.generatorContract);
    } catch {
      return res.status(500).json({ error: "Rapport kon niet gelezen worden" });
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.json(contract);
  });

  // -------------------------------------------------------------------------
  // Dezelfde inhoud, maar met het DASHBOARDTOKEN als bewijs.
  //
  // WAAROM DEZE TWEEDE WEG NODIG IS
  // Het bezitsbewijs van een afname leeft in de tabbladopslag van de browser
  // waarin het kind de reis maakte (client/src/lib/afname-bewijs.ts,
  // sessionStorage). Sluit dat tabblad, dan is het rapport langs de route
  // hierboven niet meer te openen. In de functionele test van augustus 2026 was
  // dat zichtbaar als een dashboard dat "Rapport in voorbereiding" bleef tonen
  // terwijl de afname voltooid was: het boekje bestond, maar was voor het gezin
  // onbereikbaar.
  //
  // T4Kids heeft geen server-side rapportgenerator zoals T4Teens; het boekje
  // wordt in de client getekend (aardappelillustraties, grafieken) en langs
  // window.print op A4 gezet. Er valt dus geen rapportrecord te bouwen zonder
  // dat hele boekje te dupliceren. Wat wel kan, en wat het gezin echt nodig
  // heeft, is een blijvende weg terug: het dashboardtoken bewijst hier het
  // eigenaarschap, precies zoals bij de rapportroutes in
  // server/routes-deelnemer.ts.
  // -------------------------------------------------------------------------
  app.get("/api/dashboard/:token/afname/:id/t4kids-rapport.json", async (req, res) => {
    const deelnemer = await storage.getDeelnemerByToken(req.params.token);
    if (!deelnemer) return res.status(404).json({ error: "Dashboard niet gevonden" });
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Ongeldige afname-id" });
    }
    // Eigenaarschap: de afname moet bij precies deze deelnemer horen. Zonder
    // deze controle zou een geraden afname-id het boekje van een ander kind
    // prijsgeven.
    const eigen = await storage.listAfnamesVoorDeelnemer(deelnemer.email);
    const a = eigen.find((x) => x.id === id);
    if (!a || a.instrumentId !== "t4kids") {
      return res.status(404).json({ error: "Geen T4Kids-rapport gevonden" });
    }
    if (!a.generatorContract) {
      return res.status(404).json({ error: "Rapport nog niet beschikbaar" });
    }
    let contract: unknown;
    try {
      contract = JSON.parse(a.generatorContract);
    } catch {
      return res.status(500).json({ error: "Rapport kon niet gelezen worden" });
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.json(contract);
  });
}
