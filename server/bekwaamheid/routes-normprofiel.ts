// ---------------------------------------------------------------------------
// server/bekwaamheid/routes-normprofiel.ts — de drie schrijfwegen van de norm.
//
// Scherm 9.5 uit het bouwplan (`/admin/bekwaamheid/normprofiel`) heeft precies
// drie schrijfwegen nodig, en de datalaag had ze al:
//
//   zetNeer   ->  POST   /api/bekwaamheid/normprofiel            (nieuwe versie)
//   wijzig    ->  PATCH  /api/bekwaamheid/normprofiel/:id        (concept bijstellen)
//   bevries   ->  POST   /api/bekwaamheid/normprofiel/:id/bevries (onomkeerbaar)
//
// Dit bestand voegt aan die drie geen enkele regel toe. Dat is opzet en geen
// luiheid: de onwijzigbaarheid van een bevroren cesuur staat in
// `storage.ts` — in de datalaag, niet in een formulier. Een route die zelf
// opnieuw zou toetsen of iets bevroren is, maakt een tweede waarheid, en dan is
// het een kwestie van tijd voor die twee gaan verschillen. Deze routes doen
// daarom drie dingen: het verzoek uitlezen, de opslag aanroepen, en een fout
// omzetten in een status die het scherm kan tonen.
//
// De validatie is de ene uitzondering, en met reden. `zetNeer` gooit bij een
// afgekeurd profiel één Error met alle bevindingen aan elkaar geplakt tot één
// tekst. Een formulier met acht velden kan daar niets mee. Daarom roept de route
// `valideerNormprofiel` eerst zelf aan en geeft ze de bevindingen als lijst
// terug, met per bevinding het veld erbij. Dat is geen tweede toets: het is
// dezelfde zuivere functie, en de opslag toetst daarna nog een keer. Zou de route
// het overslaan, dan zou de laag eronder alsnog weigeren.
//
// Wat deze routes NIET doen:
//
//   - ze ontdooien niets. Er is geen endpoint dat `bevroren_op` terugzet, omdat
//     er in de datalaag geen functie bestaat die dat kan;
//   - ze verwijderen niets. Een normprofiel waar beslissingen naar verwijzen,
//     verdwijnt niet;
//   - ze rekenen geen asscores en stellen geen uitkomst voor. De beslismachine
//     staat hier buiten; deze routes leveren alleen de norm waaraan ze toetst.
// ---------------------------------------------------------------------------
import type { Express, Request, Response } from "express";
import { vereisAdmin, adminIdVanSessie } from "../admin-guard";
import { bekwaamheidOpslag, type BekwaamheidOpslag } from "./storage";
import { valideerNormprofiel, type Bevinding } from "./normprofiel";
import { alleInstrumenten } from "../registry";

/**
 * Waarom het weigeren van een bevroren profiel een 409 is en geen 400.
 *
 * 400 zegt "je verzoek is fout opgeschreven"; dat is het niet. Het verzoek is
 * onberispelijk, maar de toestand van de bron laat het niet toe. Dat is precies
 * waar 409 Conflict voor is. Het scherm gebruikt het onderscheid: bij 422 zet het
 * de bevindingen bij de velden, bij 409 vervangt het het formulier door de
 * read-only weergave, want dan is er intussen bevroren.
 */
const BEVROREN_STATUS = 409;
const AFGEKEURD_STATUS = 422;

/** Herkent aan de foutmelding uit de datalaag dat het om een bevroren rij gaat. */
function gaatOverBevroren(bericht: string): boolean {
  return bericht.includes("bevroren");
}

/** Herkent aan de foutmelding uit de datalaag dat de rij niet bestaat. */
function gaatOverOnbekend(bericht: string): boolean {
  return bericht.includes("bestaat niet");
}

function foutNaarAntwoord(res: Response, fout: unknown): void {
  const bericht = fout instanceof Error ? fout.message : String(fout);
  if (gaatOverOnbekend(bericht)) {
    res.status(404).json({ fout: bericht });
    return;
  }
  if (gaatOverBevroren(bericht)) {
    res.status(BEVROREN_STATUS).json({ fout: bericht });
    return;
  }
  if (bericht.startsWith("Normprofiel afgekeurd")) {
    res.status(AFGEKEURD_STATUS).json({ fout: bericht, bevindingen: [] });
    return;
  }
  // Alles wat hier komt is onverwacht. Niet stil doorslikken: een normprofiel is
  // de cesuur, en een halve mislukking mag niet als succes ogen.
  res.status(500).json({ fout: bericht });
}

/**
 * Leest een geheel getal uit een routeparameter.
 *
 * `Number("12abc")` is NaN maar `parseInt("12abc")` is 12, en dat laatste zou een
 * bevroren profiel 12 kunnen raken via een adres dat niemand bedoeld heeft.
 */
function idUitPad(ruw: string): number | null {
  if (!/^[0-9]+$/.test(ruw)) return null;
  const id = Number(ruw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Zet de tekstvelden uit een verzoek om naar wat de opslag verwacht.
 *
 * Getallen komen uit een formulier soms als tekst binnen. Ze hier één keer
 * omzetten is beter dan de validatie laten struikelen over het type en dan een
 * bevinding tonen die over het verkeerde gaat.
 */
function getalOfOnveranderd(waarde: unknown): unknown {
  if (typeof waarde === "string" && waarde.trim() !== "") {
    const n = Number(waarde);
    if (Number.isFinite(n)) return n;
  }
  return waarde;
}

function normaliseerAsWaarden(ruw: unknown): Record<string, unknown> {
  if (!ruw || typeof ruw !== "object") return {};
  const uit: Record<string, unknown> = {};
  for (const [sleutel, waarde] of Object.entries(ruw as Record<string, unknown>)) {
    uit[sleutel] = getalOfOnveranderd(waarde);
  }
  return uit;
}

export interface NormprofielRouteOpties {
  /** Injecteerbaar zodat de test op `:memory:` kan lopen. */
  opslag?: BekwaamheidOpslag;
}

export function registerNormprofielRoutes(app: Express, opties: NormprofielRouteOpties = {}): void {
  const opslag = opties.opslag ?? bekwaamheidOpslag;

  // -------------------------------------------------------------------------
  // Lezen: welke instrumenten er zijn, en wat er per instrument staat.
  // -------------------------------------------------------------------------

  /**
   * De instrumenten waarvoor een norm kan bestaan.
   *
   * De lijst komt uit `alleInstrumenten()` en niet uit een tweede lijst in dit
   * bestand. Zou hier een eigen opsomming staan, dan zou een nieuw instrument
   * stil buiten de norm vallen.
   */
  app.get("/api/bekwaamheid/normprofiel-instrumenten", vereisAdmin, (_req: Request, res: Response) => {
    try {
      const uit = alleInstrumenten().map((d) => {
        const geldend = opslag.normprofielen.geldend(d.instrumentId);
        const versies = opslag.normprofielen.lijst(d.instrumentId);
        return {
          instrumentId: d.instrumentId,
          naam: d.name,
          geldendeVersie: geldend?.versie ?? null,
          aantalVersies: versies.length,
          heeftConcept: versies.some((v) => v.bevrorenOp === null),
        };
      });
      res.json({ instrumenten: uit });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  /**
   * Alles van één instrument: de geldende versie en de volledige historiek.
   *
   * De historiek komt mee omdat het bouwplan die onder het scherm eist. Een
   * bevroren cesuur is alleen te verantwoorden als na te lezen is wat er vóór
   * stond.
   */
  app.get("/api/bekwaamheid/normprofiel/:instrumentId", vereisAdmin, (req: Request, res: Response) => {
    try {
      const instrumentId = String(req.params.instrumentId);
      const versies = opslag.normprofielen.lijst(instrumentId);
      const geldend = opslag.normprofielen.geldend(instrumentId);
      res.json({
        instrumentId,
        geldend: geldend ?? null,
        concept: versies.find((v) => v.bevrorenOp === null) ?? null,
        versies,
      });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  // -------------------------------------------------------------------------
  // Schrijfweg 1 — een nieuwe versie neerleggen.
  // -------------------------------------------------------------------------
  app.post("/api/bekwaamheid/normprofiel", vereisAdmin, (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const invoer = {
      instrumentId: String(body.instrumentId ?? ""),
      weging: normaliseerAsWaarden(body.weging),
      drempelTotaal: getalOfOnveranderd(body.drempelTotaal),
      drempelPerAs: normaliseerAsWaarden(body.drempelPerAs),
      activiteitsdrempel: getalOfOnveranderd(body.activiteitsdrempel),
      activiteitsvensterMaanden: getalOfOnveranderd(body.activiteitsvensterMaanden),
      methode: typeof body.methode === "string" ? body.methode : "",
      paneelOmschrijving:
        typeof body.paneelOmschrijving === "string" ? body.paneelOmschrijving : null,
      vastgesteldDoor: typeof body.vastgesteldDoor === "string" ? body.vastgesteldDoor : "",
      onderbouwing: typeof body.onderbouwing === "string" ? body.onderbouwing : "",
    };

    if (!invoer.instrumentId) {
      res.status(400).json({ fout: "Geen instrument opgegeven." });
      return;
    }

    // De twee velden die de zuivere validatie niet kent maar de tabel wel eist.
    const eigenBevindingen: Bevinding[] = [];
    if (!invoer.methode.trim()) {
      eigenBevindingen.push({ veld: "methode", melding: "De methode ontbreekt." });
    }
    if (!invoer.vastgesteldDoor.trim()) {
      eigenBevindingen.push({
        veld: "vastgesteldDoor",
        melding: "Er staat niet wie de norm heeft vastgesteld.",
      });
    }

    const bevindingen = [...valideerNormprofiel(invoer), ...eigenBevindingen];
    if (bevindingen.length) {
      res.status(AFGEKEURD_STATUS).json({
        fout: "Het normprofiel is afgekeurd.",
        bevindingen,
      });
      return;
    }

    try {
      const record = opslag.normprofielen.zetNeer({
        ...(invoer as any),
        doorBeheerderId: adminIdVanSessie(req),
      });
      res.status(201).json({ normprofiel: record });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });

  // -------------------------------------------------------------------------
  // Schrijfweg 2 — een concept bijstellen.
  // -------------------------------------------------------------------------
  app.patch("/api/bekwaamheid/normprofiel/:id", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(String(req.params.id));
    if (id === null) {
      res.status(400).json({ fout: "Geen geldig normprofiel-id." });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;

    // Alleen meegestuurde velden doorgeven: `wijzig` voegt zelf samen met wat er
    // staat, en een expliciete `undefined` zou dat samenvoegen verstoren.
    const invoer: Record<string, unknown> = { doorBeheerderId: adminIdVanSessie(req) };
    if (body.weging !== undefined) invoer.weging = normaliseerAsWaarden(body.weging);
    if (body.drempelTotaal !== undefined) {
      invoer.drempelTotaal = getalOfOnveranderd(body.drempelTotaal);
    }
    if (body.drempelPerAs !== undefined) {
      invoer.drempelPerAs = normaliseerAsWaarden(body.drempelPerAs);
    }
    if (body.activiteitsdrempel !== undefined) {
      invoer.activiteitsdrempel = getalOfOnveranderd(body.activiteitsdrempel);
    }
    if (body.activiteitsvensterMaanden !== undefined) {
      invoer.activiteitsvensterMaanden = getalOfOnveranderd(body.activiteitsvensterMaanden);
    }
    if (typeof body.methode === "string") invoer.methode = body.methode;
    if (body.paneelOmschrijving !== undefined) {
      invoer.paneelOmschrijving =
        typeof body.paneelOmschrijving === "string" ? body.paneelOmschrijving : null;
    }
    if (typeof body.onderbouwing === "string") invoer.onderbouwing = body.onderbouwing;

    try {
      const record = opslag.normprofielen.wijzig(id, invoer as any);
      res.json({ normprofiel: record });
    } catch (fout) {
      // Een afgekeurde wijziging komt hier als één Error binnen. Ze wordt met de
      // zuivere validatie opnieuw uitgesplitst zodat het scherm de velden kan
      // aanwijzen — op de samengevoegde toestand, want dat is wat de opslag toetste.
      const bericht = fout instanceof Error ? fout.message : String(fout);
      if (bericht.startsWith("Normprofiel afgekeurd")) {
        const bestaand = opslag.normprofielen.vindOp(id);
        const samengevoegd = bestaand
          ? {
              weging: (invoer.weging ?? bestaand.weging) as Record<string, unknown>,
              drempelTotaal: invoer.drempelTotaal ?? bestaand.drempelTotaal,
              drempelPerAs: (invoer.drempelPerAs ?? bestaand.drempelPerAs) as Record<
                string,
                unknown
              >,
              activiteitsdrempel: invoer.activiteitsdrempel ?? bestaand.activiteitsdrempel,
              activiteitsvensterMaanden:
                invoer.activiteitsvensterMaanden ?? bestaand.activiteitsvensterMaanden,
              onderbouwing: invoer.onderbouwing ?? bestaand.onderbouwing,
            }
          : null;
        res.status(AFGEKEURD_STATUS).json({
          fout: "Het normprofiel is afgekeurd.",
          bevindingen: samengevoegd ? valideerNormprofiel(samengevoegd as any) : [],
        });
        return;
      }
      foutNaarAntwoord(res, fout);
    }
  });

  // -------------------------------------------------------------------------
  // Schrijfweg 3 — bevriezen. Onomkeerbaar, en dat staat ook in het antwoord.
  // -------------------------------------------------------------------------
  app.post("/api/bekwaamheid/normprofiel/:id/bevries", vereisAdmin, (req: Request, res: Response) => {
    const id = idUitPad(String(req.params.id));
    if (id === null) {
      res.status(400).json({ fout: "Geen geldig normprofiel-id." });
      return;
    }

    // Een bevestiging in het verzoek. Niet omdat de server de knop niet
    // vertrouwt, maar omdat dit de enige onomkeerbare handeling in de module is
    // en een verdwaald POST-verzoek haar niet mag uitvoeren.
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (body.bevestigd !== true) {
      res.status(400).json({
        fout:
          "Bevriezen is onomkeerbaar en vraagt een uitdrukkelijke bevestiging " +
          "(bevestigd: true).",
      });
      return;
    }

    try {
      const record = opslag.normprofielen.bevries(id, adminIdVanSessie(req));
      res.json({ normprofiel: record, onomkeerbaar: true });
    } catch (fout) {
      foutNaarAntwoord(res, fout);
    }
  });
}
