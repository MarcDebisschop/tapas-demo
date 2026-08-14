// ---------------------------------------------------------------------------
// server/bekwaamheid/routes-beslissingen.ts — het voorstel, de beslissing, het
// bezwaar.
//
// Hier komen de drie rekenkernen van de module voor het eerst samen achter één
// adres: `berekenAsscores` uit `normprofiel.ts`, `berekenActiviteit` uit
// `activiteit.ts` en `beoordeel` uit `beslisregels.ts`. Tot nu toe waren die
// drie alleen los getoetst.
//
// De opzet in twee wegen, en waarom:
//
//   GET  .../voorstel    rekent en toont, schrijft niets
//   POST .../beslissing  legt vast wat een mens beslist heeft
//
// Zou er één weg zijn die rekent én vastlegt, dan zou de uitkomst van de motor
// vanzelf de beslissing worden en zou de mens alleen nog op een knop drukken.
// Dat is precies het omgekeerde van wat het draaiboek wil. De motor doet een
// voorstel; twee mensen beslissen; wijkt hun beslissing af, dan schrijven ze op
// waarom. De scheiding tussen die twee adressen is de plek waar die regel
// afdwingbaar wordt.
//
// Wat het voorstel meestuurt is niet alleen de uitkomst maar de hele berekening:
// de asscores, het activiteitsbeeld, de toegepaste regels. Die gaat bij het
// vastleggen mee de databank in als `voorstel_berekening`. Bij een bezwaar drie
// jaar later is dat het enige wat nog kan laten zien op welke cijfers de
// beslissing rustte — de scores kunnen intussen herzien zijn, de cesuur kan een
// versie verder staan.
// ---------------------------------------------------------------------------
import type { Express, Request, Response } from "express";
import { vereisAdmin, adminIdVanSessie } from "../admin-guard";
import { bekwaamheidOpslag, type BekwaamheidOpslag } from "./storage";
import { berekenAsscores, type BewijsstukScore } from "./normprofiel";
import { berekenActiviteit } from "./activiteit";
import { beoordeel } from "./beslisregels";
import {
  BESLISUITKOMSTEN,
  BEZWAARUITSPRAKEN,
  type Beslisuitkomst,
  type Bezwaaruitspraak,
} from "./schema";
import { foutNaarAntwoord, getal, idUitPad, lichaam, slechtId, tekst } from "./routehulp";

export interface BeslissingRouteOpties {
  /** Injecteerbaar zodat de test op `:memory:` kan lopen. */
  opslag?: BekwaamheidOpslag;
}

export function registerBeslissingRoutes(app: Express, opties: BeslissingRouteOpties = {}): void {
  const opslag = opties.opslag ?? bekwaamheidOpslag;

  /**
   * Rekent het voorstel voor één ronde uit.
   *
   * Gedeeld door de leesweg en de schrijfweg, zodat wat het scherm toont en wat
   * de databank bewaart gegarandeerd uit dezelfde berekening komen. Zou de
   * schrijfweg opnieuw rekenen, dan kan er tussen tonen en vastleggen een score
   * gewijzigd zijn en legt de module een motivering vast bij een afwijking die
   * de beslisser nooit gezien heeft.
   */
  function rekenVoorstel(rondeId: number) {
    const ronde = opslag.rondes.vindOp(rondeId);
    if (!ronde) throw new Error(`Ronde ${rondeId} bestaat niet.`);

    const normprofiel = opslag.normprofielen.vindOp(ronde.normprofielId);
    if (!normprofiel) {
      throw new Error(`Normprofiel ${ronde.normprofielId} bestaat niet.`);
    }

    const stukken: BewijsstukScore[] = opslag.bewijsstukken.vanRonde(rondeId).map((s) => ({
      nummer: s.nummer,
      as: s.as,
      ruweScore: s.ruweScore,
      status: s.status,
    }));
    const asscores = berekenAsscores(stukken, normprofiel.weging);

    const persoon = opslag.register.vindOp(ronde.geaccrediteerdeId);
    // De activiteit hangt aan het beheerdersaccount waarmee de afnames zijn
    // aangemaakt. Staat dat er niet, dan is de teller nul en niet 'onbekend':
    // een geaccrediteerde zonder gekoppeld account heeft in dit systeem geen
    // aantoonbare praktijk, en dat mag het voorstel niet verzwijgen.
    const afnames = persoon?.beheerderId
      ? opslag.tellers.afnamesVoorActiviteit(persoon.beheerderId)
      : [];
    const peildatum = new Date().toISOString().slice(0, 10);
    const activiteit = berekenActiviteit(afnames, {
      instrumentId: ronde.instrumentId,
      peildatum,
      drempel: normprofiel.activiteitsdrempel,
      vensterMaanden: normprofiel.activiteitsvensterMaanden,
    });

    // Administratieve leemten kan een rekenkern niet vaststellen; het gaat om
    // ontbrekende stukken en niet om cijfers. Wat de module wél kan zien, is
    // dat er een bewijsstuk zonder route staat waar een opname hoorde.
    const leemten: string[] = [];
    for (const s of opslag.bewijsstukken.vanRonde(rondeId)) {
      if (s.route === "eigen_opname" && !s.opnameVerklaring) {
        leemten.push(`Bewijsstuk ${s.nummer}: eigen opname zonder toestemmingsverklaring.`);
      }
    }

    const uitkomst = beoordeel({
      normprofiel: {
        weging: normprofiel.weging,
        drempelTotaal: normprofiel.drempelTotaal,
        drempelPerAs: normprofiel.drempelPerAs,
        activiteitsdrempel: normprofiel.activiteitsdrempel,
        activiteitsvensterMaanden: normprofiel.activiteitsvensterMaanden,
      },
      asscores,
      activiteit,
      administratieveLeemten: leemten,
    });

    return {
      ronde,
      normprofielId: normprofiel.id,
      normprofielVersie: normprofiel.versie,
      peildatum,
      asscores,
      activiteit,
      administratieveLeemten: leemten,
      uitkomst,
    };
  }

  // -------------------------------------------------------------------------
  // Weg 1 — het voorstel. Leest en rekent, schrijft niets.
  // -------------------------------------------------------------------------
  app.get("/api/bekwaamheid/rondes/:id/voorstel", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "ronde")) return;
    try {
      const voorstel = rekenVoorstel(id!);
      res.json({
        voorstel,
        bestaandeBeslissing: opslag.beslissingen.vanRonde(id!) ?? null,
      });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  // -------------------------------------------------------------------------
  // Weg 2 — de beslissing. Twee mensen, en een motivering bij afwijking.
  // -------------------------------------------------------------------------
  app.post("/api/bekwaamheid/rondes/:id/beslissing", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "ronde")) return;
    const body = lichaam(req);

    const definitiefRuw = tekst(body.definitieveUitkomst);
    if (!definitiefRuw || !(BESLISUITKOMSTEN as readonly string[]).includes(definitiefRuw)) {
      res.status(422).json({
        fout: `Onbekende uitkomst. Geldig zijn: ${BESLISUITKOMSTEN.join(", ")}.`,
      });
      return;
    }
    const bekrachtigerEenId = getal(body.bekrachtigerEenId);
    const bekrachtigerTweeId = getal(body.bekrachtigerTweeId);
    if (bekrachtigerEenId === null || bekrachtigerTweeId === null) {
      res.status(400).json({ fout: "Geef twee bekrachtigers op." });
      return;
    }

    try {
      // Opnieuw rekenen op het moment van vastleggen, zodat het voorstel dat de
      // databank in gaat het voorstel is dat op dát moment gold. Het scherm
      // stuurt zijn eigen berekening niet mee: wat een cliënt aanlevert over de
      // uitkomst van de motor, is geen bewijs.
      const voorstel = rekenVoorstel(id!);

      // De motor doet geen voorstel wanneer het dossier onvolledig is: een as
      // zonder enkele beoordeelde score, bijvoorbeeld. Er is dan niets om van af
      // te wijken, en de motiveringsplicht bij afwijking zou betekenisloos
      // worden. Vastleggen kan pas als er een voorstel ligt om tegen af te zetten.
      if (voorstel.uitkomst.uitkomst === null) {
        res.status(409).json({
          fout:
            "De motor doet geen voorstel: het dossier is nog niet volledig. " +
            "Een beslissing zonder voorstel is niet vast te leggen.",
          onvolledig: voorstel.uitkomst.onvolledig,
        });
        return;
      }

      const beslissing = opslag.beslissingen.legVast({
        rondeId: id!,
        voorstelUitkomst: voorstel.uitkomst.uitkomst,
        voorstelBerekening: {
          normprofielId: voorstel.normprofielId,
          normprofielVersie: voorstel.normprofielVersie,
          peildatum: voorstel.peildatum,
          asscores: voorstel.asscores,
          activiteit: voorstel.activiteit,
          administratieveLeemten: voorstel.administratieveLeemten,
          uitkomst: voorstel.uitkomst,
        },
        definitieveUitkomst: definitiefRuw as Beslisuitkomst,
        afwijkingMotivering: tekst(body.afwijkingMotivering),
        bekrachtigerEenId,
        bekrachtigerTweeId,
        bekrachtigdOp: tekst(body.bekrachtigdOp) ?? undefined,
        doorBeheerderId: adminIdVanSessie(req),
      });
      res.status(201).json({ beslissing, voorstel: voorstel.uitkomst });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /** Het debriefgesprek vastleggen. Voorwaarde om te mogen publiceren. */
  app.post("/api/bekwaamheid/rondes/:id/debrief", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "ronde")) return;
    const body = lichaam(req);
    const debriefDoor = getal(body.debriefDoor) ?? adminIdVanSessie(req);
    if (debriefDoor === null) {
      res.status(400).json({ fout: "Geef op wie het debriefgesprek voerde." });
      return;
    }
    try {
      const beslissing = opslag.beslissingen.legDebriefVast({
        rondeId: id!,
        debriefOp: tekst(body.debriefOp) ?? undefined,
        debriefDoor,
        doorBeheerderId: adminIdVanSessie(req),
      });
      res.json({ beslissing });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /**
   * Publiceren: de uitkomst wordt zichtbaar voor de betrokkene.
   *
   * Kan alleen na het debriefgesprek. Iemand hoort zijn uitkomst van een mens te
   * horen en niet uit een scherm; die volgorde staat in het draaiboek en wordt
   * in de opslaglaag afgedwongen door een CHECK op de tabel.
   */
  app.post("/api/bekwaamheid/rondes/:id/publiceren", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "ronde")) return;
    try {
      const beslissing = opslag.beslissingen.publiceer({
        rondeId: id!,
        gepubliceerdOp: tekst(lichaam(req).gepubliceerdOp) ?? undefined,
        doorBeheerderId: adminIdVanSessie(req),
      });
      res.json({ beslissing });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  // -------------------------------------------------------------------------
  // Bezwaar.
  // -------------------------------------------------------------------------

  /** De openstaande bezwaren, voor de regiekamer. */
  app.get("/api/bekwaamheid/bezwaren", vereisAdmin, (_req: Request, res: Response) => {
    try {
      const bezwaren = opslag.bezwaren.openstaand().map((b) => {
        const ronde = opslag.rondes.vindOp(b.rondeId);
        const persoon = ronde ? opslag.register.vindOp(ronde.geaccrediteerdeId) : undefined;
        return {
          ...b,
          codenummer: ronde?.codenummer ?? null,
          naam: persoon?.naam ?? null,
        };
      });
      res.json({ bezwaren });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /**
   * Een bezwaar indienen.
   *
   * De termijn wordt hier niet getoetst. Of een bezwaar op tijd is, is een
   * oordeel met gevolgen, en dat hoort bij een mens die het motiveert — niet bij
   * een datumvergelijking die een dossier stilzwijgend laat verdwijnen. Een laat
   * bezwaar wordt geregistreerd en daarna beoordeeld; de indieningsdatum staat
   * in het dossier zodat die beoordeling erop kan steunen.
   */
  app.post("/api/bekwaamheid/rondes/:id/bezwaar", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "ronde")) return;
    const body = lichaam(req);
    const grond = tekst(body.grond);
    if (!grond) {
      res.status(422).json({ fout: "Een bezwaar heeft een grond nodig." });
      return;
    }
    try {
      const bezwaar = opslag.bezwaren.dienIn({
        rondeId: id!,
        grond,
        ingediendOp: tekst(body.ingediendOp) ?? undefined,
        doorBeheerderId: adminIdVanSessie(req),
      });
      res.status(201).json({ bezwaar });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /** De ontvangst bevestigen. */
  app.post("/api/bekwaamheid/bezwaren/:id/ontvangst", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "bezwaar")) return;
    try {
      const bezwaar = opslag.bezwaren.bevestigOntvangst({
        id: id!,
        op: tekst(lichaam(req).op) ?? undefined,
      });
      res.json({ bezwaar });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /** De uitspraak. Gegrond of deels gegrond opent de beoordeling opnieuw. */
  app.post("/api/bekwaamheid/bezwaren/:id/uitspraak", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "bezwaar")) return;
    const body = lichaam(req);
    const uitspraakRuw = tekst(body.uitspraak);
    const motivering = tekst(body.motivering);
    if (!uitspraakRuw || !(BEZWAARUITSPRAKEN as readonly string[]).includes(uitspraakRuw)) {
      res.status(422).json({
        fout: `Onbekende uitspraak. Geldig zijn: ${BEZWAARUITSPRAKEN.join(", ")}.`,
      });
      return;
    }
    if (!motivering) {
      res.status(422).json({ fout: "Een uitspraak vraagt een motivering." });
      return;
    }
    try {
      const bezwaar = opslag.bezwaren.doeUitspraak({
        id: id!,
        uitspraak: uitspraakRuw as Bezwaaruitspraak,
        motivering,
        op: tekst(body.op) ?? undefined,
        behandelaarIntern: getal(body.behandelaarIntern),
        behandelaarExternOmschrijving: tekst(body.behandelaarExternOmschrijving),
        doorBeheerderId: adminIdVanSessie(req),
      });
      res.json({ bezwaar });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });
}
