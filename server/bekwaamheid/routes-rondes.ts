// ---------------------------------------------------------------------------
// server/bekwaamheid/routes-rondes.ts — de ronde, haar bewijsstukken, haar
// scores.
//
// Eén ronde is het dossier waarin één beoordeling zich afspeelt. Ze heeft een
// fase, en die fase bepaalt wat er mag: inleveren kan alleen in `open`, scoren
// alleen tijdens de beoordeling, een beslissing alleen na het voorstel. Dat
// staat allemaal in `rondeloop.ts` en in de opslaglaag, en dit bestand herhaalt
// er niets van.
//
// Waarom niet: een route die zelf zou toetsen of de fase klopt, zou een tweede
// waarheid maken. Zolang die twee gelijk zijn, merkt niemand het; zodra er één
// verandert, weigert de ene laag wat de andere toelaat, en dan is het bij een
// bezwaar niet meer uit te leggen welke van de twee gold. De routes hier lezen
// het verzoek uit, roepen de opslag aan, en vertalen een weigering naar een
// status.
//
// Eén ding doen ze wél zelf: het samenstellen van het dossierbeeld voor het
// scherm. `GET /api/bekwaamheid/rondes/:id` brengt de ronde, haar bewijsstukken,
// haar scores, haar beslissing en haar bezwaren in één antwoord samen. Dat is
// geen logica maar een samenvoeging, en ze staat hier omdat het scherm anders
// vijf verzoeken achter elkaar zou doen en tussentijds een half beeld zou tonen.
// ---------------------------------------------------------------------------
import type { Express, Request, Response } from "express";
import { vereisAdmin, adminIdVanSessie } from "../admin-guard";
import { bekwaamheidOpslag, type BekwaamheidOpslag } from "./storage";
import {
  ASSEN,
  BEWIJSSTUKROUTES,
  RONDEFASEN,
  RONDESOORTEN,
  type As,
  type Bewijsstukroute,
  type Rondefase,
  type Rondesoort,
} from "./schema";
import { foutNaarAntwoord, getal, idUitPad, lichaam, slechtId, tekst } from "./routehulp";

export interface RondeRouteOpties {
  /** Injecteerbaar zodat de test op `:memory:` kan lopen. */
  opslag?: BekwaamheidOpslag;
}

export function registerRondeRoutes(app: Express, opties: RondeRouteOpties = {}): void {
  const opslag = opties.opslag ?? bekwaamheidOpslag;

  // -------------------------------------------------------------------------
  // Lezen.
  // -------------------------------------------------------------------------

  /** De rondes, eventueel gefilterd op fase of instrument. */
  app.get("/api/bekwaamheid/rondes", vereisAdmin, (req: Request, res: Response) => {
    const faseRuw = tekst(req.query.fase);
    if (faseRuw && !(RONDEFASEN as readonly string[]).includes(faseRuw)) {
      res.status(400).json({ fout: `Onbekende fase '${faseRuw}'.` });
      return;
    }
    try {
      const rondes = opslag.rondes.lijst({
        fase: (faseRuw as Rondefase | null) ?? undefined,
        instrumentId: tekst(req.query.instrumentId) ?? undefined,
      });
      res.json({
        rondes: rondes.map((r) => {
          const persoon = opslag.register.vindOp(r.geaccrediteerdeId);
          const stukken = opslag.bewijsstukken.vanRonde(r.id);
          return {
            ...r,
            naam: persoon?.naam ?? null,
            aantalBewijsstukken: stukken.length,
            aantalBeoordeeld: stukken.filter((s) => s.status === "beoordeeld").length,
          };
        }),
      });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /** Het volledige dossier van één ronde in één antwoord. */
  app.get("/api/bekwaamheid/rondes/:id", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "ronde")) return;
    try {
      const ronde = opslag.rondes.vindOp(id!);
      if (!ronde) {
        res.status(404).json({ fout: `Ronde ${id} bestaat niet.` });
        return;
      }
      res.json({
        ronde,
        persoon: opslag.register.vindOp(ronde.geaccrediteerdeId) ?? null,
        normprofiel: opslag.normprofielen.vindOp(ronde.normprofielId) ?? null,
        bewijsstukken: opslag.bewijsstukken.vanRonde(id!),
        scores: opslag.scores.vanRonde(id!),
        beslissing: opslag.beslissingen.vanRonde(id!) ?? null,
        bezwaren: opslag.bezwaren.vanRonde(id!),
      });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /**
   * Het codenummer dat de volgende ronde zou krijgen.
   *
   * Puur ter voorbeschouwing op het openingsscherm. Het nummer wordt hier niet
   * gereserveerd: reserveren zou een gat achterlaten wanneer iemand het
   * formulier sluit, en een genummerde reeks met gaten roept bij een audit
   * vragen op die er niet zijn.
   */
  app.get("/api/bekwaamheid/rondes-volgend-nummer", vereisAdmin, (_req: Request, res: Response) => {
    try {
      res.json({ codenummer: opslag.rondes.volgendCodenummer(), gereserveerd: false });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  // -------------------------------------------------------------------------
  // Schrijven: de ronde zelf.
  // -------------------------------------------------------------------------

  /** Een ronde openen. Weigert zonder bevroren cesuur. */
  app.post("/api/bekwaamheid/rondes", vereisAdmin, (req: Request, res: Response) => {
    const body = lichaam(req);
    const geaccrediteerdeId = getal(body.geaccrediteerdeId);
    const instrumentId = tekst(body.instrumentId);
    const soortRuw = tekst(body.soort);

    if (geaccrediteerdeId === null || !instrumentId) {
      res.status(400).json({ fout: "Geef een geaccrediteerde en een instrument op." });
      return;
    }
    if (!soortRuw || !(RONDESOORTEN as readonly string[]).includes(soortRuw)) {
      res.status(422).json({
        fout: `Onbekende rondesoort. Geldig zijn: ${RONDESOORTEN.join(", ")}.`,
      });
      return;
    }

    try {
      const ronde = opslag.rondes.open({
        geaccrediteerdeId,
        instrumentId,
        soort: soortRuw as Rondesoort,
        geopendOp: tekst(body.geopendOp) ?? undefined,
        vensterMaanden: getal(body.vensterMaanden) ?? undefined,
        notitieIntern: tekst(body.notitieIntern),
        doorBeheerderId: adminIdVanSessie(req),
      });
      res.status(201).json({ ronde });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /** De fase verzetten. Staken vraagt een reden. */
  app.post("/api/bekwaamheid/rondes/:id/fase", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "ronde")) return;
    const body = lichaam(req);
    const naarRuw = tekst(body.naar);
    if (!naarRuw || !(RONDEFASEN as readonly string[]).includes(naarRuw)) {
      res.status(422).json({ fout: `Onbekende fase. Geldig zijn: ${RONDEFASEN.join(", ")}.` });
      return;
    }
    try {
      const ronde = opslag.rondes.verzetFase({
        id: id!,
        naar: naarRuw as Rondefase,
        reden: tekst(body.reden),
        doorBeheerderId: adminIdVanSessie(req),
      });
      res.json({ ronde });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /**
   * Een aanpassing vastleggen: extra tijd, een aangepaste opdracht, een
   * hulpmiddel.
   *
   * Met verplichte reden, en zichtbaar in het dossier. Een aanpassing die
   * nergens staat, is bij een bezwaar niet te onderscheiden van een gunst.
   */
  app.post("/api/bekwaamheid/rondes/:id/aanpassing", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "ronde")) return;
    const body = lichaam(req);
    const aanpassingen = tekst(body.aanpassingen);
    const reden = tekst(body.reden);
    if (!aanpassingen || !reden) {
      res.status(422).json({ fout: "Een aanpassing vraagt zowel een omschrijving als een reden." });
      return;
    }
    try {
      const ronde = opslag.rondes.legAanpassingVast({
        id: id!,
        aanpassingen,
        reden,
        doorBeheerderId: adminIdVanSessie(req),
      });
      res.json({ ronde });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  // -------------------------------------------------------------------------
  // Schrijven: de bewijsstukken.
  // -------------------------------------------------------------------------

  /** Een bewijsstuk neerzetten. Kan alleen in de voorbereiding. */
  app.post("/api/bekwaamheid/rondes/:id/bewijsstukken", vereisAdmin, (req: Request, res: Response) => {
    const rondeId = idUitPad(req.params.id);
    if (slechtId(res, rondeId, "ronde")) return;
    const body = lichaam(req);
    const nummer = getal(body.nummer);
    const asRuw = tekst(body.as);
    const weging = getal(body.weging);
    const routeRuw = tekst(body.route);

    if (nummer === null || weging === null) {
      res.status(400).json({ fout: "Geef een nummer en een weging op." });
      return;
    }
    if (!asRuw || !(ASSEN as readonly string[]).includes(asRuw)) {
      res.status(422).json({ fout: `Onbekende as. Geldig zijn: ${ASSEN.join(", ")}.` });
      return;
    }
    if (routeRuw && !(BEWIJSSTUKROUTES as readonly string[]).includes(routeRuw)) {
      res.status(422).json({
        fout: `Onbekende route. Geldig zijn: ${BEWIJSSTUKROUTES.join(", ")}.`,
      });
      return;
    }

    try {
      const bewijsstuk = opslag.bewijsstukken.zetNeer({
        rondeId: rondeId!,
        nummer,
        as: asRuw as As,
        weging,
        route: (routeRuw as Bewijsstukroute | null) ?? null,
        // Een ja/nee en geen tekst: de tabel bewaart of de verklaring er is,
        // niet wat er in staat. Het stuk zelf hoort in het dossier en niet in
        // een kolom.
        opnameVerklaring: body.opnameVerklaring === true,
        // Geen itemset mee: de koppeling loopt de andere kant op. Een itemset
        // wordt samengesteld voor een ronde plus een bewijsstuknummer, en die
        // richting is de juiste — het bewijsstuk bestaat eerst, de vragenset komt
        // erbij. Zou het bewijsstuk een set moeten aanwijzen bij het neerzetten,
        // dan zou een set moeten bestaan voordat er iets is om vragen over te
        // stellen.
      });
      res.status(201).json({ bewijsstuk });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /** Een bewijsstuk inleveren. Kan alleen op een open ronde. */
  app.post("/api/bekwaamheid/bewijsstukken/:id/inleveren", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "bewijsstuk")) return;
    try {
      const bewijsstuk = opslag.bewijsstukken.leverIn({
        id: id!,
        ingeleverdOp: tekst(lichaam(req).ingeleverdOp) ?? undefined,
      });
      res.json({ bewijsstuk });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /**
   * Een bewijsstuk op niet van toepassing zetten, met reden.
   *
   * Dit is geen nul. Een stuk op `nvt` telt niet mee in het gemiddelde en telt
   * ook niet als openstaand; een nul zou de as omlaag trekken voor iets wat de
   * kandidaat niet kón laten zien. Het onderscheid staat in `berekenAsscores`
   * en is de reden dat deze weg apart bestaat.
   */
  app.post("/api/bekwaamheid/bewijsstukken/:id/nvt", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "bewijsstuk")) return;
    const reden = tekst(lichaam(req).reden);
    if (!reden) {
      res.status(422).json({ fout: "Niet van toepassing zetten vraagt een reden." });
      return;
    }
    try {
      const bewijsstuk = opslag.bewijsstukken.markeerNvt({
        id: id!,
        reden,
        doorBeheerderId: adminIdVanSessie(req),
      });
      res.json({ bewijsstuk });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  // -------------------------------------------------------------------------
  // Schrijven: de scores.
  // -------------------------------------------------------------------------

  /** De scores op één bewijsstuk, van alle beoordelaars. */
  app.get("/api/bekwaamheid/bewijsstukken/:id/scores", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "bewijsstuk")) return;
    try {
      res.json({ scores: opslag.scores.vanBewijsstuk(id!) });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /**
   * Een score invoeren.
   *
   * De beoordelaar is degene die is aangemeld en komt niet uit het verzoek. Zou
   * het lichaam een beoordelaar-id mogen meegeven, dan kan iemand een score op
   * naam van een ander zetten, en dan is de dubbele beoordeling die de hele
   * opzet draagt een formaliteit geworden.
   */
  app.post("/api/bekwaamheid/bewijsstukken/:id/scores", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "bewijsstuk")) return;
    const beoordelaarId = adminIdVanSessie(req);
    if (beoordelaarId === null) {
      res.status(403).json({ fout: "Een score hoort bij een aangemelde beoordelaar." });
      return;
    }
    const body = lichaam(req);
    const onderdeel = tekst(body.onderdeel);
    const score = getal(body.score);
    const onderbouwing = tekst(body.onderbouwing);
    if (!onderdeel || score === null || !onderbouwing) {
      res.status(400).json({ fout: "Geef een onderdeel, een score en een onderbouwing op." });
      return;
    }
    try {
      const uit = opslag.scores.voerIn({
        bewijsstukId: id!,
        beoordelaarId,
        onderdeel,
        score,
        onderbouwing,
        isKalibratie: body.isKalibratie === true,
      });
      res.status(201).json({ score: uit });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /** Een eigen score herzien. De opslaglaag weigert het voor een ander. */
  app.patch("/api/bekwaamheid/scores/:id", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "score")) return;
    const beoordelaarId = adminIdVanSessie(req);
    if (beoordelaarId === null) {
      res.status(403).json({ fout: "Herzien hoort bij een aangemelde beoordelaar." });
      return;
    }
    const body = lichaam(req);
    const score = getal(body.score);
    const onderbouwing = tekst(body.onderbouwing);
    if (score === null || !onderbouwing) {
      res.status(400).json({ fout: "Geef een score en een onderbouwing op." });
      return;
    }
    try {
      const uit = opslag.scores.herzie({ id: id!, beoordelaarId, score, onderbouwing });
      res.json({ score: uit });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /**
   * Een bewijsstuk afronden: de scores middelen en op `beoordeeld` zetten.
   *
   * Aparte handeling en geen automatisme na de laatste score, omdat de module
   * niet weet hoeveel beoordelaars er hadden moeten zijn. Zou ze afronden zodra
   * er één score staat, dan zou een dossier met één beoordelaar er hetzelfde
   * uitzien als een dossier met twee.
   */
  app.post("/api/bekwaamheid/bewijsstukken/:id/afronden", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "bewijsstuk")) return;
    try {
      const bewijsstuk = opslag.scores.rondBewijsstukAf({
        bewijsstukId: id!,
        doorBeheerderId: adminIdVanSessie(req),
      });
      res.json({ bewijsstuk });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });
}
