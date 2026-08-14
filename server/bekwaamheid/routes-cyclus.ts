// ---------------------------------------------------------------------------
// server/bekwaamheid/routes-cyclus.ts — het tussentijdse controlemoment, het
// coachingsplan en de agenda.
//
// Dit is de laag die de tweejarige cyclus bewaakt. Ze bestaat omdat de cyclus in
// het draaiboek van drie jaar naar twee is gebracht met een evaluatiemoment na
// het eerste jaar. Dat moment kijkt naar drie dingen: het aantal afnames, de
// scores van de SMT's, en — bij te veel twijfels — een coachingsplan met de
// vermelding 'alert'.
//
// De volgorde van de wegen hier volgt die van het draaiboek:
//
//   voorbereiden   de module rekent en stelt een uitkomst voor
//   vaststellen    een mens beslist; wijkt hij af, dan motiveert hij
//   publiceren     de uitkomst wordt zichtbaar
//   plan opstellen alleen wanneer de signalen dat vragen
//
// `bereidVoor` schrijft wél: de toets komt als rij in de databank te staan met
// haar berekening erin. Dat wijkt af van het voorstel bij de eindbeslissing, dat
// niets schrijft, en dat is met opzet: de tussentijdse toets is zelf een
// gebeurtenis in de cyclus die op datum moet vaststaan, ook wanneer er daarna
// niets bijzonders uit komt. Bij de eindbeslissing is de gebeurtenis de
// beslissing en niet de berekening.
// ---------------------------------------------------------------------------
import type { Express, Request, Response } from "express";
import { vereisAdmin, adminIdVanSessie } from "../admin-guard";
import { bekwaamheidOpslag, type BekwaamheidOpslag } from "./storage";
import { foutNaarAntwoord, getal, idUitPad, lichaam, slechtId, tekst } from "./routehulp";

export interface CyclusRouteOpties {
  /** Injecteerbaar zodat de test op `:memory:` kan lopen. */
  opslag?: BekwaamheidOpslag;
}

export function registerCyclusRoutes(app: Express, opts: CyclusRouteOpties = {}): void {
  const opslag = opts.opslag ?? bekwaamheidOpslag;

  // -------------------------------------------------------------------------
  // Het tussentijdse controlemoment.
  // -------------------------------------------------------------------------

  /** De toetsen van één persoon, nieuwste eerst. */
  app.get("/api/bekwaamheid/toetsen/:persoonId", vereisAdmin, (req: Request, res: Response) => {
    const persoonId = idUitPad(req.params.persoonId);
    if (slechtId(res, persoonId, "geaccrediteerde")) return;
    try {
      res.json({ toetsen: opslag.toetsen.vanPersoon(persoonId!) });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /** Eén toets met het bijhorende plan, wanneer er een is. */
  app.get("/api/bekwaamheid/toets/:id", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "toets")) return;
    try {
      const toets = opslag.toetsen.vindOp(id!);
      if (!toets) {
        res.status(404).json({ fout: `Tussentijdse toets ${id} bestaat niet.` });
        return;
      }
      res.json({ toets });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /**
   * Een toets voorbereiden voor één licentie.
   *
   * De teller haalt haar getallen uit het beheerdersaccount dat aan de persoon
   * hangt. Dat account wordt hier niet uit het verzoek gelezen maar uit het
   * register: zou de cliënt mogen kiezen wiens afnames geteld worden, dan is de
   * activiteitsdrempel niets meer waard.
   */
  app.post("/api/bekwaamheid/toetsen", vereisAdmin, (req: Request, res: Response) => {
    const body = lichaam(req);
    const licentieId = getal(body.licentieId);
    if (licentieId === null) {
      res.status(400).json({ fout: "Geef een licentie op." });
      return;
    }
    try {
      const licentie = opslag.licenties.vindOp(licentieId);
      if (!licentie) {
        res.status(404).json({ fout: `Licentie ${licentieId} bestaat niet.` });
        return;
      }
      const persoon = opslag.register.vindOp(licentie.geaccrediteerdeId);
      const toets = opslag.toetsen.bereidVoor({
        licentieId,
        peildatum: tekst(body.peildatum) ?? undefined,
        beheerderIdVoorTelling: persoon?.beheerderId ?? null,
      });
      res.status(201).json({ toets });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /**
   * De uitkomst vaststellen.
   *
   * Zonder `uitkomst` in het verzoek neemt de opslaglaag de berekende uitkomst
   * over. Dat is geen gemak maar een regel: wie de berekening volgt, hoeft niets
   * te motiveren; wie ervan afwijkt, wel. Het verschil tussen die twee gevallen
   * moet uit de rij zelf af te lezen zijn, en dat kan alleen wanneer het
   * meesturen van een uitkomst een bewuste handeling is.
   */
  app.post("/api/bekwaamheid/toetsen/:id/vaststellen", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "toets")) return;
    const body = lichaam(req);
    try {
      const toets = opslag.toetsen.stelVast({
        toetsId: id!,
        uitkomst: (tekst(body.uitkomst) ?? undefined) as never,
        afwijkingMotivering: "afwijkingMotivering" in body ? tekst(body.afwijkingMotivering) : undefined,
        besprokenOp: "besprokenOp" in body ? tekst(body.besprokenOp) : undefined,
        doorBeheerderId: adminIdVanSessie(req),
      });
      res.json({ toets });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /** De uitkomst zichtbaar maken. */
  app.post("/api/bekwaamheid/toetsen/:id/publiceren", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "toets")) return;
    try {
      const toets = opslag.toetsen.publiceer(id!, adminIdVanSessie(req));
      res.json({ toets });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /** Het gesprek over de toets vastleggen. */
  app.post("/api/bekwaamheid/toetsen/:id/gesprek", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "toets")) return;
    const besprokenOp = tekst(lichaam(req).besprokenOp);
    if (!besprokenOp) {
      res.status(422).json({ fout: "Geef de datum van het gesprek op." });
      return;
    }
    try {
      opslag.toetsen.legGesprekVast(id!, besprokenOp);
      res.json({ toets: opslag.toetsen.vindOp(id!) });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  // -------------------------------------------------------------------------
  // Het coachingsplan.
  // -------------------------------------------------------------------------

  /**
   * Een plan opstellen bij een toets.
   *
   * De opslaglaag weigert een plan bij een toets zonder signalen. Een plan
   * zonder aanleiding is een dossier dat een probleem suggereert dat de meting
   * niet gevonden heeft, en dat werkt tegen de betrokkene.
   */
  app.post("/api/bekwaamheid/coachingsplannen", vereisAdmin, (req: Request, res: Response) => {
    const body = lichaam(req);
    const toetsId = getal(body.toetsId);
    const doel = tekst(body.doel);
    if (toetsId === null || !doel) {
      res.status(400).json({ fout: "Geef een toets en een doel op." });
      return;
    }
    if (!Array.isArray(body.afspraken) || body.afspraken.length === 0) {
      res.status(422).json({ fout: "Een plan zonder afspraken is geen plan." });
      return;
    }
    try {
      const planId = opslag.plannen.stelOp({
        toetsId,
        doel,
        afspraken: body.afspraken,
        begeleiderId: getal(body.begeleiderId),
        opgesteldDoor: adminIdVanSessie(req),
        evaluatieOp: tekst(body.evaluatieOp) ?? undefined,
      });
      res.status(201).json({ planId });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /** Het akkoord van de betrokkene vastleggen. Voorwaarde om af te kunnen sluiten. */
  app.post("/api/bekwaamheid/coachingsplannen/:id/akkoord", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "coachingsplan")) return;
    try {
      opslag.plannen.legAkkoordVast(id!, tekst(lichaam(req).opDatum) ?? undefined);
      res.json({ akkoord: true });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /** Een plan afsluiten met een uitkomst. */
  app.post("/api/bekwaamheid/coachingsplannen/:id/afsluiten", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "coachingsplan")) return;
    const uitkomst = tekst(lichaam(req).uitkomst);
    if (!uitkomst) {
      res.status(422).json({ fout: "Geef de uitkomst van het plan op." });
      return;
    }
    try {
      opslag.plannen.sluitAf({
        planId: id!,
        uitkomst: uitkomst as never,
        doorBeheerderId: adminIdVanSessie(req),
      });
      res.json({ afgesloten: true });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  // -------------------------------------------------------------------------
  // De agenda.
  // -------------------------------------------------------------------------

  /**
   * Wat op of voor de peildatum openstaat.
   *
   * Zonder peildatum: vandaag. Er is geen weg die de hele agenda teruggeeft,
   * inclusief afgehandelde posten — een lijst die alles toont, wordt niet gelezen,
   * en dan blijft er iets staan wat een licentie laat vervallen.
   */
  app.get("/api/bekwaamheid/agenda", vereisAdmin, (req: Request, res: Response) => {
    try {
      const peildatum = tekst(req.query.peildatum) ?? new Date().toISOString().slice(0, 10);
      const posten = opslag.agenda.openstaand(peildatum).map((p) => {
        const persoon = opslag.register.vindOp(p.geaccrediteerdeId);
        return { ...p, naam: persoon?.naam ?? null };
      });
      res.json({ peildatum, posten });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /** Een post afhandelen. */
  app.post("/api/bekwaamheid/agenda/:id/afhandelen", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "agendapost")) return;
    try {
      opslag.agenda.handelAf(id!);
      res.json({ afgehandeld: true });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /**
   * De licenties die op de peildatum een toets nodig hebben.
   *
   * Aparte weg naast de agenda omdat het een berekening is en geen voorraad: de
   * agenda bevat wat iemand heeft klaargezet, dit is wat de cyclus zegt. Lopen
   * die twee uiteen, dan is er een post vergeten, en dat is precies wat je wil
   * kunnen zien.
   */
  app.get("/api/bekwaamheid/vervallende-toetsen", vereisAdmin, (req: Request, res: Response) => {
    try {
      const peildatum = tekst(req.query.peildatum) ?? new Date().toISOString().slice(0, 10);
      res.json({ peildatum, licenties: opslag.licenties.toetsenDieVervallen(peildatum) });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });
}
