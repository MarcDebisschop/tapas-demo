// ---------------------------------------------------------------------------
// server/bekwaamheid/routes-items.ts — de itembank en de kennischeck.
//
// Twee dingen die bij elkaar horen en toch los staan:
//
//   het item     één vraag, met haar sleutel en haar herkomst
//   de itemset   de vragen die één kandidaat op één bewijsstuk kreeg
//
// De itemset is bewust een eigen rij en geen verwijzing naar een filter. Zou de
// module de vragen bij het nakijken opnieuw selecteren met dezelfde criteria,
// dan verandert de toets zodra de bank verandert, en dan is bij een bezwaar niet
// meer vast te stellen welke vragen iemand werkelijk gezien heeft. De set legt
// dat vast op het moment van samenstellen.
//
// Wat hier NIET staat: er is geen endpoint dat een item verwijdert. Een item
// waar itemsets naar verwijzen, verdwijnt niet; het gaat op `gebruik` uit de
// roulatie en blijft bestaan zodat oude toetsen leesbaar blijven.
//
// De sleutel van een item gaat nooit mee naar de kandidaatzijde. Die scheiding
// zit niet in dit bestand maar in de opslaglaag, en de leesroutes hier zijn
// allemaal achter `vereisAdmin`. Een kandidaatweg naar de itembank bestaat niet.
// ---------------------------------------------------------------------------
import type { Express, Request, Response } from "express";
import { vereisAdmin, adminIdVanSessie } from "../admin-guard";
import { bekwaamheidOpslag, type BekwaamheidOpslag } from "./storage";
import { foutNaarAntwoord, getal, idUitPad, lichaam, slechtId, tekst } from "./routehulp";

export interface ItemRouteOpties {
  /** Injecteerbaar zodat de test op `:memory:` kan lopen. */
  opslag?: BekwaamheidOpslag;
}

/** Leest een lijst met tekstopties uit een verzoek. */
function opties(waarde: unknown): string[] | null {
  if (!Array.isArray(waarde)) return null;
  const uit = waarde.filter((o): o is string => typeof o === "string" && o.trim() !== "");
  return uit.length ? uit : null;
}

export function registerItemRoutes(app: Express, opts: ItemRouteOpties = {}): void {
  const opslag = opts.opslag ?? bekwaamheidOpslag;

  // -------------------------------------------------------------------------
  // De bank.
  // -------------------------------------------------------------------------

  /**
   * De items van één instrument, met de dekking per blok erbij.
   *
   * De dekking komt in hetzelfde antwoord mee omdat ze de reden is waarom
   * iemand naar dit scherm gaat: niet om een lijst te bekijken, maar om te zien
   * waar de bank te dun is. Een aparte aanroep zou het scherm eerst een lijst
   * laten tonen en daarna een waarschuwing, en dan is de waarschuwing te laat.
   */
  app.get("/api/bekwaamheid/items/:instrumentId", vereisAdmin, (req: Request, res: Response) => {
    try {
      const instrumentId = String(req.params.instrumentId);
      const items = opslag.items.lijst(instrumentId, {
        as: tekst(req.query.as) ?? undefined,
        blok: tekst(req.query.blok) ?? undefined,
        gebruik: tekst(req.query.gebruik) ?? undefined,
        alleenActief: req.query.alle !== "1",
      });
      res.json({ instrumentId, items, dekking: opslag.items.dekking(instrumentId) });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /** Eén item. */
  app.get("/api/bekwaamheid/item/:id", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "item")) return;
    try {
      const item = opslag.items.vindOp(id!);
      if (!item) {
        res.status(404).json({ fout: `Item ${id} bestaat niet.` });
        return;
      }
      res.json({ item });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /** Een item neerleggen. De validatie zit in `valideerItem`. */
  app.post("/api/bekwaamheid/items", vereisAdmin, (req: Request, res: Response) => {
    const body = lichaam(req);
    const instrumentId = tekst(body.instrumentId);
    const as = tekst(body.as);
    const soort = tekst(body.soort);
    const stam = tekst(body.stam);
    const sleutel = tekst(body.sleutel);
    // Beide toelichtingen zijn verplicht in de opslaglaag en dat is geen
    // formaliteit: de terugkoppeling bij een fout antwoord is het enige stuk van
    // de kennischeck dat iemand iets leert. Een item zonder die twee teksten is
    // een strafpunt zonder uitleg.
    const toelichtingGoed = tekst(body.toelichtingGoed);
    const toelichtingFout = tekst(body.toelichtingFout);
    if (!instrumentId || !as || !soort || !stam || !sleutel) {
      res.status(400).json({
        fout: "Geef minstens een instrument, een as, een soort, een stam en een sleutel op.",
      });
      return;
    }
    if (!toelichtingGoed || !toelichtingFout) {
      res.status(422).json({
        fout: "Geef een toelichting bij een goed en bij een fout antwoord.",
      });
      return;
    }
    try {
      const item = opslag.items.zetNeer({
        instrumentId,
        as,
        blok: tekst(body.blok),
        soort,
        stam,
        opties: opties(body.opties),
        sleutel,
        toelichtingGoed,
        toelichtingFout,
        bronVerwijzing: tekst(body.bronVerwijzing),
        doorBeheerderId: adminIdVanSessie(req),
      });
      res.status(201).json({ item });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /** Een item bijstellen. */
  app.patch("/api/bekwaamheid/item/:id", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "item")) return;
    const body = lichaam(req);
    try {
      const item = opslag.items.wijzig(id!, {
        blok: "blok" in body ? tekst(body.blok) : undefined,
        stam: tekst(body.stam) ?? undefined,
        opties: "opties" in body ? opties(body.opties) : undefined,
        sleutel: tekst(body.sleutel) ?? undefined,
        toelichtingGoed: tekst(body.toelichtingGoed) ?? undefined,
        toelichtingFout: tekst(body.toelichtingFout) ?? undefined,
        gebruik: (tekst(body.gebruik) ?? undefined) as never,
        doorBeheerderId: adminIdVanSessie(req),
      });
      res.json({ item });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  // -------------------------------------------------------------------------
  // De kennischeck.
  // -------------------------------------------------------------------------

  /** De set die bij één bewijsstuk van één ronde hoort. */
  app.get("/api/bekwaamheid/itemset/:rondeId/:nummer", vereisAdmin, (req: Request, res: Response) => {
    const rondeId = idUitPad(req.params.rondeId);
    const nummer = idUitPad(req.params.nummer);
    if (slechtId(res, rondeId, "ronde")) return;
    if (slechtId(res, nummer, "bewijsstuk-nummer")) return;
    try {
      const set = opslag.itemsets.vindVoorBewijsstuk(rondeId!, nummer!);
      res.json({ itemset: set ?? null });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /**
   * Een set samenstellen.
   *
   * Met een zaad, zodat dezelfde aanroep dezelfde set geeft. Dat is nodig om de
   * samenstelling te kunnen naspelen bij een bezwaar; zonder zaad zou een
   * kandidaat die klaagt over een te zware toets nooit kunnen laten zien dat hij
   * zwaarder was dan die van een ander.
   */
  app.post("/api/bekwaamheid/itemsets", vereisAdmin, (req: Request, res: Response) => {
    const body = lichaam(req);
    const rondeId = getal(body.rondeId);
    if (rondeId === null) {
      res.status(400).json({ fout: "Geef een ronde op." });
      return;
    }
    try {
      const itemset = opslag.itemsets.stelSamen({
        rondeId,
        bewijsstukNummer: getal(body.bewijsstukNummer) ?? undefined,
        plan: (body.plan ?? undefined) as never,
        zaad: getal(body.zaad) ?? undefined,
        doorBeheerderId: adminIdVanSessie(req),
      });
      res.status(201).json({ itemset });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /** De antwoorden van de kandidaat inleveren. */
  app.post("/api/bekwaamheid/itemsets/:id/inleveren", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "itemset")) return;
    const body = lichaam(req);
    const antwoorden = body.antwoorden;
    if (!antwoorden || typeof antwoorden !== "object" || Array.isArray(antwoorden)) {
      res.status(400).json({ fout: "Geef de antwoorden als object mee." });
      return;
    }
    try {
      const itemset = opslag.itemsets.leverIn({
        itemsetId: id!,
        antwoorden: antwoorden as Record<string, string>,
        itemTijden: (body.itemTijden ?? null) as Record<string, number> | null,
        doorBeheerderId: adminIdVanSessie(req),
      });
      res.json({ itemset });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /**
   * Nakijken, met de mogelijkheid een item uit te sluiten.
   *
   * Uitsluiten met reden en niet stil: een item dat achteraf ondeugdelijk blijkt,
   * moet uit de telling van alle kandidaten die het kregen, en dat is alleen
   * terug te vinden wanneer de uitsluiting zelf is opgeschreven.
   */
  app.post("/api/bekwaamheid/itemsets/:id/nakijken", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(req.params.id);
    if (slechtId(res, id, "itemset")) return;
    const body = lichaam(req);
    const uitsluiten = Array.isArray(body.uitsluiten)
      ? body.uitsluiten.map((n) => getal(n)).filter((n): n is number => n !== null)
      : undefined;
    if (uitsluiten?.length && !tekst(body.redenUitsluiting)) {
      res.status(422).json({ fout: "Een item uitsluiten vraagt een reden." });
      return;
    }
    try {
      const uit = opslag.itemsets.keurNa({
        itemsetId: id!,
        handmatigeScores: (body.handmatigeScores ?? undefined) as Record<string, number> | undefined,
        uitsluiten,
        redenUitsluiting: tekst(body.redenUitsluiting) ?? undefined,
      });
      res.json({ nakijkresultaat: uit });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });
}
