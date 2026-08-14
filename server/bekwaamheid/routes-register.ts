// ---------------------------------------------------------------------------
// server/bekwaamheid/routes-register.ts — wie er is, wat hij ooit behaalde, en
// wat hij vandaag mag.
//
// Drie dingen die makkelijk door elkaar lopen en die dit bestand uit elkaar
// houdt:
//
//   het register       wie er bestaat als geaccrediteerde
//   de accreditatie    wat iemand ooit behaald heeft — een historisch feit
//   de licentie        wat iemand vandaag mag — een toestand die vervalt
//
// Het verschil is niet academisch. Een accreditatie uit 2019 blijft waar, ook
// wanneer de licentie erop in 2026 is opgeschort. Zou de module die twee in één
// veld bewaren, dan zou het intrekken van een bevoegdheid het behalen ervan
// uitwissen, en dan is er bij een bezwaar niets meer na te lezen. Daarom staan
// ze in twee tabellen en hier in twee groepen eindpunten.
//
// Wat dit bestand niet doet: het beslist niets. De licentiestatus verandert
// alleen via `naBekrachtiging`, en die wordt aangeroepen vanuit de beslisweg in
// `routes-beslissingen.ts`. Er is hier geen endpoint dat een status rechtstreeks
// zet, want een bevoegdheid die met één knop te wijzigen is zonder beslissing
// eronder, is geen bevoegdheid maar een instelling.
// ---------------------------------------------------------------------------
import type { Express, Request, Response } from "express";
import { vereisAdmin, adminIdVanSessie } from "../admin-guard";
import { bekwaamheidOpslag, type BekwaamheidOpslag } from "./storage";
import { BEWIJSHERKOMSTEN, type Bewijsherkomst } from "./schema";
import { foutNaarAntwoord, getal, idUitPad, lichaam, slechtId, tekst } from "./routehulp";

export interface RegisterRouteOpties {
  /** Injecteerbaar zodat de test op `:memory:` kan lopen. */
  opslag?: BekwaamheidOpslag;
}

export function registerRegisterRoutes(app: Express, opties: RegisterRouteOpties = {}): void {
  const opslag = opties.opslag ?? bekwaamheidOpslag;

  // -------------------------------------------------------------------------
  // Het register.
  // -------------------------------------------------------------------------

  /**
   * De lijst van geaccrediteerden.
   *
   * Standaard alleen de actieve. Wie inactief is gezet, verdwijnt uit de
   * dagelijkse lijst maar niet uit de databank; met `?alle=1` komt hij terug in
   * beeld. Dat is nodig omdat een oude ronde naar hem verwijst en die ronde
   * anders naar een naam wijst die het scherm niet kan tonen.
   */
  app.get("/api/bekwaamheid/register", vereisAdmin, (req: Request, res: Response) => {
    try {
      const alle = req.query.alle === "1" || req.query.alle === "true";
      const personen = opslag.register.lijst(!alle);
      res.json({
        personen: personen.map((p) => ({
          ...p,
          licenties: opslag.licenties.vanPersoon(p.id),
          accreditaties: opslag.accreditaties.vanPersoon(p.id),
        })),
      });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /** Eén dossier: de persoon, zijn licenties, zijn accreditaties, zijn rondes. */
  app.get("/api/bekwaamheid/register/:id", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "register")) return;
    try {
      const persoon = opslag.register.vindOp(id!);
      if (!persoon) {
        res.status(404).json({ fout: `Geaccrediteerde ${id} bestaat niet.` });
        return;
      }
      res.json({
        persoon,
        licenties: opslag.licenties.vanPersoon(id!),
        accreditaties: opslag.accreditaties.vanPersoon(id!),
        rondes: opslag.rondes.vanPersoon(id!),
      });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /** Iemand in het register zetten. */
  app.post("/api/bekwaamheid/register", vereisAdmin, (req: Request, res: Response) => {
    const body = lichaam(req);
    const naam = tekst(body.naam);
    if (!naam) {
      res.status(400).json({ fout: "Een geaccrediteerde heeft een naam nodig." });
      return;
    }
    try {
      const persoon = opslag.register.zetNeer({
        naam,
        email: tekst(body.email),
        beheerderId: getal(body.beheerderId),
        coachRegisterId: getal(body.coachRegisterId),
        doorBeheerderId: adminIdVanSessie(req),
      });
      res.status(201).json({ persoon });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /**
   * Iemand inactief zetten, met reden.
   *
   * Geen DELETE. Er is geen weg om een geaccrediteerde te verwijderen zolang er
   * rondes, beslissingen en bezwaren naar hem verwijzen, en die verwijzingen
   * blijven bestaan zolang de bewaartermijn loopt.
   */
  app.post("/api/bekwaamheid/register/:id/inactief", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "register")) return;
    const reden = tekst(lichaam(req).reden);
    if (!reden) {
      res.status(422).json({ fout: "Inactief zetten vraagt een reden." });
      return;
    }
    try {
      const persoon = opslag.register.zetInactief(id!, adminIdVanSessie(req), reden);
      res.json({ persoon });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  // -------------------------------------------------------------------------
  // Licenties.
  // -------------------------------------------------------------------------

  /** De licenties van één persoon, met de agenda die eraan hangt. */
  app.get("/api/bekwaamheid/licenties/:persoonId", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.persoonId);
    if (slechtId(res, id, "register")) return;
    try {
      res.json({ licenties: opslag.licenties.vanPersoon(id!) });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /**
   * De overgangsperiode openen voor iemand die nog geen licentie heeft.
   *
   * Dit is de enige weg waarlangs een licentie ontstaat zonder beslissing
   * eronder, en ze bestaat omdat de module niet op nul kan beginnen: bij
   * invoering hebben de zittende praktijkmensen een status nodig waarmee ze
   * mogen blijven werken tot hun eerste ronde rond is.
   */
  app.post("/api/bekwaamheid/licenties/overgangsperiode", vereisAdmin, (req: Request, res: Response) => {
    const body = lichaam(req);
    const geaccrediteerdeId = getal(body.geaccrediteerdeId);
    const instrumentId = tekst(body.instrumentId);
    if (geaccrediteerdeId === null || !instrumentId) {
      res.status(400).json({ fout: "Geef een geaccrediteerde en een instrument op." });
      return;
    }
    try {
      const licentie = opslag.licenties.zetOvergangsperiode({
        geaccrediteerdeId,
        instrumentId,
        geldigVan: tekst(body.geldigVan) ?? undefined,
      });
      res.status(201).json({ licentie });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /**
   * De alertvlag zetten of weghalen.
   *
   * De vlag zelf ontneemt geen enkel recht. Ze is een signaal voor de
   * tussentijdse toets en voor het scherm, en dat is precies waarom ze los van
   * de status staat: een zorg is nog geen sanctie.
   */
  app.post("/api/bekwaamheid/licenties/:id/alert", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "licentie")) return;
    const actief = lichaam(req).actief;
    if (typeof actief !== "boolean") {
      res.status(400).json({ fout: "Geef 'actief' als true of false op." });
      return;
    }
    try {
      const licentie = opslag.licenties.zetAlert(id!, actief, adminIdVanSessie(req));
      res.json({ licentie });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  // -------------------------------------------------------------------------
  // Accreditaties.
  // -------------------------------------------------------------------------

  /** Wat iemand ooit behaalde, ingetrokken stukken inbegrepen. */
  app.get("/api/bekwaamheid/accreditaties/:persoonId", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.persoonId);
    if (slechtId(res, id, "register")) return;
    try {
      res.json({ accreditaties: opslag.accreditaties.vanPersoon(id!) });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /** Een behaalde accreditatie vastleggen. */
  app.post("/api/bekwaamheid/accreditaties", vereisAdmin, (req: Request, res: Response) => {
    const body = lichaam(req);
    const geaccrediteerdeId = getal(body.geaccrediteerdeId);
    const instrumentId = tekst(body.instrumentId);
    const niveau = getal(body.niveau);
    const behaaldOp = tekst(body.behaaldOp);
    const herkomstRuw = tekst(body.bewijsHerkomst);

    if (geaccrediteerdeId === null || !instrumentId || niveau === null || !behaaldOp) {
      res.status(400).json({
        fout: "Geef een geaccrediteerde, een instrument, een niveau en een datum op.",
      });
      return;
    }
    if (!herkomstRuw || !(BEWIJSHERKOMSTEN as readonly string[]).includes(herkomstRuw)) {
      res.status(422).json({
        fout: `Onbekende bewijsherkomst. Geldig zijn: ${BEWIJSHERKOMSTEN.join(", ")}.`,
      });
      return;
    }

    try {
      const accreditatie = opslag.accreditaties.legVast({
        geaccrediteerdeId,
        instrumentId,
        niveau,
        behaaldOp,
        opleidingId: getal(body.opleidingId),
        bewijsHerkomst: herkomstRuw as Bewijsherkomst,
        doorBeheerderId: adminIdVanSessie(req),
      });
      res.status(201).json({ accreditatie });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /**
   * Een accreditatie intrekken.
   *
   * POST en geen DELETE, omdat er niets weggaat. De rij blijft staan met een
   * datum en een reden erbij. Dat is het verschil tussen "dit is nooit gebeurd"
   * en "dit is gebeurd en later ongeldig verklaard", en alleen het tweede is
   * hier waar.
   */
  app.post("/api/bekwaamheid/accreditaties/:id/intrekken", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "accreditatie")) return;
    const reden = tekst(lichaam(req).reden);
    if (!reden) {
      res.status(422).json({ fout: "Intrekken vraagt een reden." });
      return;
    }
    try {
      const accreditatie = opslag.accreditaties.trekIn({
        id: id!,
        reden,
        doorBeheerderId: adminIdVanSessie(req),
      });
      res.json({ accreditatie });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });
}
