// ---------------------------------------------------------------------------
// server/bekwaamheid/routes-regiekamer.ts — de twee leeswegen van scherm 9.6.
//
//   GET  /api/bekwaamheid/regiekamer                het beeld
//   POST /api/bekwaamheid/regiekamer/poortsimulatie  wat de poort zou doen
//
// Dit bestand haalt op en rekent niet. Elke uitkomst komt uit `regiekamer.ts`,
// die geen databank kent. Wat hier staat, zijn de queries, en die zijn met opzet
// plat: één SELECT per grootheid, geen views, geen tijdelijke tabellen. De
// regiekamer is een leesscherm; ze mag nooit iets aanpassen om iets te kunnen
// tonen.
//
// Waarom de poortsimulatie een POST is en geen GET. Ze schrijft niets — maar ze
// draagt wel een samenstelling van vijf velden, waaronder een stand die de
// werkelijke stand overschrijft. Zo'n samenstelling in een querystring belandt in
// serverlogs en in browsergeschiedenis, en een gedeelde link die "handhaaf"
// simuleert terwijl de poort op `log` staat, is een misverstand dat je niet wil
// uitleggen.
//
// De simulatie schrijft géén auditregel. `beoordeelSchrijfweg` neemt de
// auditschrijver als argument, en hier gaat er één in die niets doet. Dat is
// wezenlijk: het auditlog is het verhaal van wat er echt gebeurde met echte
// afnames. Een gesimuleerde weigering die daar tussen staat, maakt dat verhaal
// onbetrouwbaar, en het auditlog is precies het stuk waarvan later niemand mag
// twijfelen.
// ---------------------------------------------------------------------------
import type { Express, Request, Response } from "express";
import { vereisAdmin } from "../admin-guard";
import { bekwaamheidOpslag, type BekwaamheidOpslag } from "./storage";
import { HANDELINGEN, type Handeling } from "./poort";
import { POORTSTANDEN, type Poortstand } from "./rechten";
import { beoordeelSchrijfweg } from "./poortbrug";
import {
  telRondesPerFase,
  vatAgendaSamen,
  iccPerBewijsstuk,
  vindOnvolledigBeoordeeld,
  meetProcesKpis,
  beoordeelItembank,
  NIET_GEMETEN,
  type RegiekamerBeeld,
  type RondeRegel,
  type ScoreRegel,
  type DebriefRegel,
  type PublicatieRegel,
  type BezwaarRegel,
  type ItemRegel,
} from "./regiekamer";
import type { Rondefase } from "./schema";

/** Vandaag als ISO-dag. Eén plek, zodat de peildatum overal hetzelfde begint. */
function vandaag(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Leest een peildatum uit de querystring.
 *
 * Een onleesbare datum wordt niet stil vervangen door vandaag: dan zou het
 * scherm een ander beeld tonen dan waar het om vroeg, zonder dat iemand het
 * merkt. Er komt een 400 op.
 */
function leesPeildatum(ruw: unknown): string | null {
  if (ruw === undefined || ruw === null || ruw === "") return vandaag();
  if (typeof ruw !== "string") return null;
  const dag = ruw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dag)) return null;
  return Number.isNaN(Date.parse(dag + "T00:00:00Z")) ? null : dag;
}

/**
 * Bouwt het beeld op uit de databank.
 *
 * De filtering op instrument gaat overal via de ronde en niet via een tweede
 * kolom. De rondes dragen het instrument; bewijsstukken, scores, beslissingen en
 * bezwaren hangen eronder. Zou elk van die tabellen zelf een instrument-kolom
 * krijgen om deze query korter te maken, dan bestaan er vijf antwoorden op de
 * vraag bij welk instrument een score hoort.
 */
export function leesRegiekamer(
  peildatum: string,
  instrumentId: string | null,
  opslag: BekwaamheidOpslag = bekwaamheidOpslag,
): RegiekamerBeeld {
  const db = opslag.verbinding();
  const filterRonde = instrumentId ? "WHERE r.instrument_id = ?" : "";
  const arg = instrumentId ? [instrumentId] : [];

  const rondes = db
    .prepare(
      `SELECT r.id, r.fase, r.soort, r.instrument_id, r.venster_tot
         FROM bekwaamheid_rondes r
         ${filterRonde}`,
    )
    .all(...arg) as Array<{
    id: number;
    fase: string;
    soort: string;
    instrument_id: string;
    venster_tot: string;
  }>;

  const rondeRegels: RondeRegel[] = rondes.map((r) => ({
    id: r.id,
    fase: r.fase as Rondefase,
    soort: r.soort,
    instrumentId: r.instrument_id,
    vensterTot: r.venster_tot,
  }));

  // De agenda heeft al een eigenaar in de opslag; die wordt hier gebruikt en
  // niet nagebouwd. Het instrumentfilter komt er na de opzoeking bij, omdat de
  // agendapost het instrument zelf draagt.
  const agenda = opslag.agenda
    .openstaand(peildatum)
    .filter((p) => (instrumentId ? p.instrumentId === instrumentId : true));

  const scores = db
    .prepare(
      `SELECT s.bewijsstuk_id, b.nummer, s.beoordelaar_id, s.onderdeel, s.score, s.is_kalibratie
         FROM bekwaamheid_scores s
         JOIN bekwaamheid_bewijsstukken b ON b.id = s.bewijsstuk_id
         JOIN bekwaamheid_rondes r ON r.id = b.ronde_id
         ${filterRonde}`,
    )
    .all(...arg) as Array<{
    bewijsstuk_id: number;
    nummer: number;
    beoordelaar_id: number;
    onderdeel: string;
    score: number;
    is_kalibratie: number;
  }>;

  const scoreRegels: ScoreRegel[] = scores.map((s) => ({
    bewijsstukId: s.bewijsstuk_id,
    bewijsstukNummer: s.nummer,
    beoordelaarId: s.beoordelaar_id,
    onderdeel: s.onderdeel,
    score: s.score,
    isKalibratie: s.is_kalibratie === 1,
  }));

  // "Laatste onderdeel" is de jongste inleverdatum binnen de ronde. Dat is de
  // enige datum in het model die het einde van wat de kandidaat moest doen
  // vastlegt; `beoordeeld_op` is het einde van wat het panel deed en zou de
  // termijn laten meebewegen met de eigen traagheid.
  const debriefs = db
    .prepare(
      `SELECT r.id AS ronde_id,
              (SELECT MAX(b.ingeleverd_op)
                 FROM bekwaamheid_bewijsstukken b
                WHERE b.ronde_id = r.id AND b.ingeleverd_op IS NOT NULL) AS laatste,
              (SELECT MAX(d.debrief_op)
                 FROM bekwaamheid_beslissingen d
                WHERE d.ronde_id = r.id) AS debrief
         FROM bekwaamheid_rondes r
         ${filterRonde}`,
    )
    .all(...arg) as Array<{ ronde_id: number; laatste: string | null; debrief: string | null }>;

  const debriefRegels: DebriefRegel[] = debriefs
    .filter((d) => d.laatste !== null)
    .map((d) => ({
      rondeId: d.ronde_id,
      laatsteOnderdeelOp: d.laatste,
      debriefOp: d.debrief,
    }));

  const publicaties = db
    .prepare(
      `SELECT d.id, d.debrief_op, d.gepubliceerd_op
         FROM bekwaamheid_beslissingen d
         JOIN bekwaamheid_rondes r ON r.id = d.ronde_id
         ${filterRonde}`,
    )
    .all(...arg) as Array<{ id: number; debrief_op: string | null; gepubliceerd_op: string | null }>;

  const publicatieRegels: PublicatieRegel[] = publicaties.map((p) => ({
    beslissingId: p.id,
    debriefOp: p.debrief_op,
    gepubliceerdOp: p.gepubliceerd_op,
  }));

  const bezwaren = db
    .prepare(
      `SELECT z.id, z.ingediend_op, z.uitspraak_op
         FROM bekwaamheid_bezwaren z
         JOIN bekwaamheid_rondes r ON r.id = z.ronde_id
         ${filterRonde}`,
    )
    .all(...arg) as Array<{ id: number; ingediend_op: string; uitspraak_op: string | null }>;

  const bezwaarRegels: BezwaarRegel[] = bezwaren.map((z) => ({
    bezwaarId: z.id,
    ingediendOp: z.ingediend_op,
    uitspraakOp: z.uitspraak_op,
  }));

  const items = db
    .prepare(
      `SELECT id, p_waarde, discriminatie, actief
         FROM bekwaamheid_items
         ${instrumentId ? "WHERE instrument_id = ?" : ""}`,
    )
    .all(...arg) as Array<{
    id: number;
    p_waarde: number | null;
    discriminatie: number | null;
    actief: number;
  }>;

  const itemRegels: ItemRegel[] = items.map((i) => ({
    id: i.id,
    pWaarde: i.p_waarde,
    discriminatie: i.discriminatie,
    actief: i.actief === 1,
  }));

  // Eén keer rekenen en twee keer gebruiken: de lijst met onvolledig beoordeelde
  // bewijsstukken is een doorsnede van dezelfde uitkomst. Twee keer rekenen zou
  // twee waarheden kunnen opleveren zodra er ooit iets aan verandert.
  const icc = iccPerBewijsstuk(scoreRegels);

  return {
    peildatum,
    rondes: telRondesPerFase(rondeRegels, peildatum),
    agenda: vatAgendaSamen(agenda, peildatum),
    icc,
    onvolledigBeoordeeld: vindOnvolledigBeoordeeld(icc),
    proces: meetProcesKpis({
      debriefs: debriefRegels,
      publicaties: publicatieRegels,
      bezwaren: bezwaarRegels,
    }),
    itembank: beoordeelItembank(itemRegels),
    nietGemeten: [...NIET_GEMETEN],
  };
}

/** Alleen deze twee getallen mogen uit het verzoek komen. */
function leesId(ruw: unknown): number | null {
  if (ruw === undefined || ruw === null || ruw === "") return null;
  const n = Number(ruw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function registerRegiekamerRoutes(app: Express): void {
  app.get(
    "/api/bekwaamheid/regiekamer",
    vereisAdmin,
    async (req: Request, res: Response): Promise<void> => {
      const peildatum = leesPeildatum(req.query.peildatum);
      if (peildatum === null) {
        res.status(400).json({ error: "Peildatum onleesbaar; verwacht JJJJ-MM-DD." });
        return;
      }
      const instrument =
        typeof req.query.instrument === "string" && req.query.instrument !== ""
          ? req.query.instrument
          : null;
      try {
        res.json(leesRegiekamer(peildatum, instrument));
      } catch (err) {
        console.error("[bekwaamheid/regiekamer] lezen mislukt:", err);
        res.status(500).json({ error: "De regiekamer kon niet worden opgebouwd." });
      }
    },
  );

  app.post(
    "/api/bekwaamheid/regiekamer/poortsimulatie",
    vereisAdmin,
    async (req: Request, res: Response): Promise<void> => {
      const lijf = (req.body ?? {}) as Record<string, unknown>;

      const handeling = lijf.handeling;
      if (typeof handeling !== "string" || !HANDELINGEN.includes(handeling as Handeling)) {
        res.status(400).json({ error: `Handeling onbekend. Keuze uit: ${HANDELINGEN.join(", ")}.` });
        return;
      }

      const stand = lijf.stand ?? "handhaaf";
      if (typeof stand !== "string" || !POORTSTANDEN.includes(stand as Poortstand)) {
        res.status(400).json({ error: `Stand onbekend. Keuze uit: ${POORTSTANDEN.join(", ")}.` });
        return;
      }

      const peildatum = leesPeildatum(lijf.peildatum);
      if (peildatum === null) {
        res.status(400).json({ error: "Peildatum onleesbaar; verwacht JJJJ-MM-DD." });
        return;
      }

      const instrumentId =
        typeof lijf.instrumentId === "string" && lijf.instrumentId !== "" ? lijf.instrumentId : null;

      try {
        const uitkomst = await beoordeelSchrijfweg(
          {
            handeling: handeling as Handeling,
            instrumentId,
            verzender: {
              aangemaaktDoorBeheerderId: leesId(lijf.beheerderId),
              aangemaaktDoorOrganisatieId: leesId(lijf.organisatieId),
            },
            peildatum,
            stand: stand as Poortstand,
          },
          bekwaamheidOpslag,
          bekwaamheidOpslag.verbinding(),
          // De simulatie laat geen spoor in het auditlog. Zie de kop.
          () => {},
        );
        res.json({ ...uitkomst, gesimuleerd: true, peildatum, stand });
      } catch (err) {
        console.error("[bekwaamheid/regiekamer] simulatie mislukt:", err);
        res.status(500).json({ error: "De simulatie kon niet worden uitgevoerd." });
      }
    },
  );
}
