// ---------------------------------------------------------------------------
// server/t4students/uitstuurcontrole.ts
//
// De poort voor het uitsturen van een studiekompas.
//
// WAAROM DIT BESTAAT
// Wachttoetsen draaien in de bouwpijplijn. Ze zeggen dus iets over de code op
// het moment van bouwen, niet over de server die op dit ogenblik draait. Tussen
// die twee zit ruimte: een frontend die niet meegebouwd raakte, een oudere
// bouw die nog draait, een instrumentbestand dat op de schijf van de server
// vervangen werd, een vertaling die halfweg verdween. De opdrachtgever wil geen
// belofte over de code maar over de uitnodiging: wat de deur uitgaat, werkt.
//
// Deze module speelt daarom de volledige keten na op de levende server, in het
// proces zelf, en levert een oordeel. Geen enkele uitnodiging voor T4Students
// wordt aangemaakt zolang dat oordeel niet sluit. Faalt de keten, dan krijgt de
// verzender de reden te zien en is er niets aangemaakt, niets verstuurd en geen
// credit verbruikt.
//
// WAT ER NAGESPELDEN WORDT, PER TAAL VAN HET INSTRUMENT
//   1. De vragenlijstroute staat aangemeld op de levende express-app.
//   2. De inleverroute van deel 2 staat aangemeld op dezelfde app.
//   3. De vragenlijst levert items, onder precies de sleutels waarop de
//      scoringsmotor leest. Geen enkele ontbrekende, geen enkele vreemde.
//   4. Elk item draagt tekst in de gevraagde taal.
//   5. Een volledig ingevuld antwoordenblad wordt door de serverzijdige
//      volledigheidspoort aanvaard.
//   6. Een antwoordenblad in de blokvorm van een ander instrument wordt door
//      diezelfde poort geweigerd. Dat was de oorspronkelijke storing.
//   7. Het afnamecontract wordt gebouwd en draagt echte uitkomsten: een
//      ijkpunt, gescoorde constructen, gerangschikte foci en versnellers.
//      Nulwaarden en leegtes worden geweigerd.
//   8. Het contract gaat door de leescontrole heen na een rondje door JSON,
//      precies zoals het uit de databank terugkomt.
//   9. De rapportketen bouwt de bladen uit dat contract.
//  10. Er komt een echte PDF uit, met de kenmerken van een PDF en een
//      geloofwaardige omvang.
//
// Voor de gebouwde frontend staat er een aparte controle: de uitgeleverde
// bundel moet het adres van de vragenlijst en het adres van het invulscherm
// nog dragen. Ontbreekt de bundel, bijvoorbeeld in ontwikkelmodus, dan wordt
// die controle overgeslagen en gemeld, niet stil goedgekeurd.
//
// De uitslag wordt per proces bewaard zodra ze sluit: de keten verandert niet
// tussen twee verzoeken op dezelfde bouw. Een negatieve uitslag wordt niet
// bewaard, zodat een herstel zonder herstart doorwerkt.
// ---------------------------------------------------------------------------

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Express } from "express";
import type { BlokAntwoord } from "@shared/verplicht-antwoorden";
import { T4STUDENTS_INSTRUMENT } from "./instrument";
import type { T4SInstrument, T4SItem } from "./instrument";
import { bouwT4StudentsVragenlijst } from "../routes/vragenlijst-t4students";
import { itemsVanInstrument, aantalVerplichteItems } from "./antwoorden";
import { bouwT4StudentsAfnameContract, leesT4StudentsContract } from "./afnamecontract";
import { bouwRapportUitContract, pdfVanRapport } from "./rapport-keten";
import { controleerAfnameVolledig } from "../volledigheid-afname";

/** De talen waarin het studiekompas bestaat. Gelijk aan de vragenlijstroute. */
const TALEN = ["nl", "fr", "en"] as const;
type Taal = (typeof TALEN)[number];

export interface Bevinding {
  code: string;
  taal: string | null;
  omschrijving: string;
  geslaagd: boolean;
  detail?: string;
}

export interface Uitstuuroordeel {
  ok: boolean;
  gecontroleerdOp: string;
  bevindingen: Bevinding[];
  meldingen: string[];
  /** Aantal geslaagde en gefaalde controles, voor het logboek. */
  geslaagd: number;
  gefaald: number;
}

let bewaardOordeel: Uitstuuroordeel | null = null;

/** Zet de bewaarde uitslag terug. Voor de toetsen en voor een handmatige hercontrole. */
export function vergeetUitstuuroordeel(): void {
  bewaardOordeel = null;
}

/**
 * Vult de vragenlijst zoals het invulscherm dat doet: per itemsoort het veld
 * dat de scoring voor dat item leest. De waarden zijn bewust niet nul, zodat
 * een rapport met nulwaarden onmiddellijk opvalt.
 */
/**
 * Een volledig ingevuld antwoordenblad, zoals het invulscherm het inlevert. De
 * vorm per item verschilt per soort vraag, daarom is de waarde hier los
 * getypeerd en wordt ze bij de volledigheidscontrole omgezet naar de vorm die
 * die controle verwacht, precies zoals de inleverroute dat doet.
 */
function vulVolledigIn(items: ReturnType<typeof bouwT4StudentsVragenlijst>["items"]) {
  const uit: Record<string, unknown> = {};
  let keuzeP1: string | null = null;
  for (const item of items) {
    const soort = item.itemType ?? "";
    if (soort === "open-intro") {
      uit[item.id] = { text: "Ik zoek een richting die bij me past." };
    } else if (soort === "battery") {
      uit[item.id] = { value: 7 };
    } else if (soort === "recognition+energy") {
      uit[item.id] = { recognition: 3, energy: 2 };
    } else if (soort === "recognition") {
      uit[item.id] = { recognition: 3 };
    } else if (soort === "interest") {
      uit[item.id] = { interest: 2 };
    } else if (item.options && item.options.length > 0) {
      uit[item.id] = { choice: item.options[0]!.key };
      if (item.id === "P1") keuzeP1 = item.options[0]!.key;
    }
  }
  const afhankelijk = items.find((i) => i.variants);
  if (afhankelijk && keuzeP1) {
    const variant = afhankelijk.variants![keuzeP1];
    if (variant) {
      uit[afhankelijk.id] =
        variant.itemType === "profile-scale"
          ? { value: 6 }
          : { choice: variant.options?.[0]?.key ?? "A" };
    }
  }
  return uit;
}

/** Een antwoordenblad in de blokvorm van een ander instrument. */
function blokvormAntwoordenblad(aantal: number): Record<string, unknown> {
  const uit: Record<string, unknown> = {};
  for (let i = 0; i < aantal; i += 1) {
    uit[`B${i}`] = {
      most: "A",
      least: "B",
      itemEnergy: { most: 2, least: -2 },
      blockEnergy: null,
      toelichting: null,
    };
  }
  return uit;
}

/** Staan de routes die de keten nodig heeft aangemeld op deze app? */
function aangemeldeWegen(app: Express | null | undefined): string[] {
  if (!app) return [];
  const stapel =
    (app as unknown as { router?: { stack?: unknown[] }; _router?: { stack?: unknown[] } }).router
      ?.stack ??
    (app as unknown as { _router?: { stack?: unknown[] } })._router?.stack ??
    [];
  const wegen: string[] = [];
  const loop = (laag: unknown) => {
    const l = laag as {
      route?: { path?: string };
      name?: string;
      handle?: { stack?: unknown[] };
    };
    if (l.route?.path) wegen.push(l.route.path);
    if (l.handle?.stack) for (const k of l.handle.stack) loop(k);
  };
  for (const laag of stapel) loop(laag);
  return wegen;
}

/**
 * Draagt de uitgeleverde frontend de adressen van de keten nog?
 *
 * Naar buiten gebracht zodat de toetsen deze controle apart kunnen nakijken,
 * zonder de volledige keten in drie talen na te spelen. Dat de keuring deze
 * bevindingen werkelijk meeneemt, is los afgedekt door de mutatieproef.
 */
export function bundelBevindingen(wortel: string): Bevinding[] {
  const map = join(wortel, "dist", "public", "assets");
  if (!existsSync(map)) {
    return [
      {
        code: "F0",
        taal: null,
        omschrijving: "uitgeleverde frontend aanwezig",
        geslaagd: true,
        detail: "overgeslagen: er staat geen gebouwde frontend in dist/public",
      },
    ];
  }
  let alles = "";
  for (const naam of readdirSync(map)) {
    if (naam.endsWith(".js")) alles += readFileSync(join(map, naam), "utf8");
  }
  const zoek = (tekst: string, code: string, wat: string): Bevinding => ({
    code,
    taal: null,
    omschrijving: wat,
    geslaagd: alles.includes(tekst),
    detail: alles.includes(tekst) ? undefined : `niet gevonden in de bundel: ${tekst}`,
  });
  return [
    zoek(
      "/api/vragenlijst/tapas-t4students",
      "F1",
      "de frontend haalt de vragenlijst van het studiekompas op",
    ),
    zoek("/studiekompas", "F2", "de frontend kent het adres van het invulscherm"),
  ];
}

/**
 * Speelt de volledige keten na en levert een oordeel.
 *
 * @param app  de levende express-app, voor de controle op aangemelde routes.
 *             Blijft die weg, dan wordt de routecontrole overgeslagen en gemeld.
 * @param instrument  het instrument, standaard het echte studiekompas.
 */
export async function keurUitstuurT4Students(opties?: {
  app?: Express | null;
  instrument?: T4SInstrument;
  wortel?: string;
  negeerBewaard?: boolean;
}): Promise<Uitstuuroordeel> {
  if (bewaardOordeel && bewaardOordeel.ok && !opties?.negeerBewaard) return bewaardOordeel;

  const instrument = opties?.instrument ?? T4STUDENTS_INSTRUMENT;
  const wortel = opties?.wortel ?? process.cwd();
  const bevindingen: Bevinding[] = [];
  const meldingen: string[] = [];

  const meld = (
    code: string,
    taal: string | null,
    omschrijving: string,
    geslaagd: boolean,
    detail?: string,
  ) => {
    bevindingen.push({ code, taal, omschrijving, geslaagd, detail });
  };

  // 1 en 2. De wegen van de keten staan aangemeld.
  // Zonder app kan er niets over de wegen gezegd worden en wordt dat gemeld.
  // Een app die wel meegegeven is maar geen enkele weg draagt, is geen reden om
  // over te slaan: dat is precies een gebroken server.
  if (!opties?.app) {
    meldingen.push(
      "De routecontrole is overgeslagen: er is geen levende app meegegeven.",
    );
    meld("R0", null, "aangemelde wegen leesbaar", true, "overgeslagen");
  } else {
    const wegen = aangemeldeWegen(opties.app);
    meld(
      "R1",
      null,
      "de vragenlijstroute van het studiekompas staat aangemeld",
      wegen.includes("/api/vragenlijst/tapas-t4students"),
      wegen.includes("/api/vragenlijst/tapas-t4students")
        ? undefined
        : "GET /api/vragenlijst/tapas-t4students is niet aangemeld op de server",
    );
    const inlever = wegen.some((w: string) => w.includes("/api/afnames/:id/connection"));
    meld(
      "R2",
      null,
      "de inleverroute van deel 2 staat aangemeld",
      inlever,
      inlever ? undefined : "POST /api/afnames/:id/connection is niet aangemeld op de server",
    );
  }

  // 3 tot 10, per taal.
  const scoringIds = new Set(itemsVanInstrument(instrument).map((i: T4SItem) => i.id));
  for (const taal of TALEN) {
    let lijst: ReturnType<typeof bouwT4StudentsVragenlijst>;
    try {
      lijst = bouwT4StudentsVragenlijst(taal, instrument);
    } catch (e) {
      meld("V1", taal, "de vragenlijst kan gebouwd worden", false, String(e));
      continue;
    }

    meld("V1", taal, "de vragenlijst levert items", lijst.items.length > 0, `${lijst.items.length} items`);

    const geleverd = new Set(lijst.items.map((i) => i.id));
    const ontbrekend = Array.from(scoringIds).filter((id) => !geleverd.has(id));
    const vreemd = Array.from(geleverd).filter((id) => !scoringIds.has(id));
    meld(
      "V2",
      taal,
      "elk item van de scoring wordt aangeboden, en niets anders",
      ontbrekend.length === 0 && vreemd.length === 0,
      ontbrekend.length === 0 && vreemd.length === 0
        ? `${geleverd.size} sleutels sluiten`
        : `ontbrekend: ${ontbrekend.join(", ") || "geen"}; vreemd: ${vreemd.join(", ") || "geen"}`,
    );

    // Een item met varianten draagt zijn tekst in de varianten en niet op het
    // item zelf. Voor zo'n item wordt elke variant nagekeken.
    const zonderTekst: string[] = [];
    for (const i of lijst.items) {
      if (i.variants && Object.keys(i.variants).length > 0) {
        for (const [sleutel, variant] of Object.entries(i.variants)) {
          if (!String(variant.text ?? "").trim()) zonderTekst.push(`${i.id}/${sleutel}`);
        }
        continue;
      }
      if (!String(i.text ?? "").trim()) zonderTekst.push(i.id);
    }
    meld(
      "V3",
      taal,
      "elk item draagt tekst in deze taal",
      zonderTekst.length === 0,
      zonderTekst.length === 0
        ? `${lijst.items.length} items met tekst`
        : `zonder tekst: ${zonderTekst.join(", ")}`,
    );

    const antwoordenblad = vulVolledigIn(lijst.items);

    const volledig = controleerAfnameVolledig({
      instrumentId: "t4students",
      responses: antwoordenblad as Record<string, BlokAntwoord>,
      keuzes: null,
      taal,
    });
    meld(
      "P1",
      taal,
      "een volledig ingevuld blad wordt aanvaard",
      volledig.volledig,
      volledig.volledig ? undefined : `geweigerd, ontbreekt: ${volledig.ontbreekt.join(", ")}`,
    );

    const blokvorm = controleerAfnameVolledig({
      instrumentId: "t4students",
      responses: blokvormAntwoordenblad(34) as Record<string, BlokAntwoord>,
      keuzes: null,
      taal,
    });
    const verwachtAantal = aantalVerplichteItems(instrument);
    meld(
      "P2",
      taal,
      "een blad in de blokvorm van een ander instrument wordt geweigerd",
      !blokvorm.volledig && blokvorm.ontbreekt.length === verwachtAantal,
      blokvorm.volledig
        ? "de poort liet een blad van een ander instrument door"
        : `geweigerd met ${blokvorm.ontbreekt.length} van ${verwachtAantal} ontbrekende items`,
    );

    let contract;
    try {
      contract = bouwT4StudentsAfnameContract({
        respondentCode: "UITSTUURCONTROLE",
        name: "Uitstuurcontrole",
        taal,
        responses: antwoordenblad,
        instrument,
      });
    } catch (e) {
      meld("C1", taal, "het afnamecontract kan gebouwd worden", false, String(e));
      continue;
    }
    meld("C1", taal, "het afnamecontract kan gebouwd worden", true);

    const r = contract.resultaat;
    const constructen = Object.values(r.constructScores ?? {});
    const nietNul = constructen.filter(
      (c) => typeof c.recognition === "number" && Number.isFinite(c.recognition) && c.recognition !== 0,
    ).length;
    meld(
      "C2",
      taal,
      "het contract draagt echte uitkomsten, geen nulrapport",
      r.ijkpunt?.waarde != null &&
        constructen.length > 0 &&
        nietNul > 0 &&
        (r.foci?.sorted?.length ?? 0) > 0 &&
        (r.versnellers?.rangorde?.length ?? 0) > 0,
      `ijkpunt ${String(r.ijkpunt?.waarde)}, ${nietNul} van ${constructen.length} constructen niet nul, ` +
        `${r.foci?.sorted?.length ?? 0} foci, ${r.versnellers?.rangorde?.length ?? 0} versnellers`,
    );
    meld(
      "C3",
      taal,
      "er blijft geen verplicht item onbeantwoord",
      (contract.ontbrekend?.length ?? 0) === 0,
      `ontbrekend: ${contract.ontbrekend?.length ?? 0}`,
    );
    meld("C4", taal, "de taal van het contract volgt de afname", contract.taal === taal, contract.taal);

    let gelezen;
    try {
      gelezen = leesT4StudentsContract(JSON.parse(JSON.stringify(contract)));
      meld("C5", taal, "het contract komt door de leescontrole na een rondje door JSON", true);
    } catch (e) {
      meld("C5", taal, "het contract komt door de leescontrole", false, String(e));
      continue;
    }

    let rapport;
    try {
      rapport = bouwRapportUitContract(gelezen);
    } catch (e) {
      meld("D1", taal, "de rapportbladen kunnen gebouwd worden", false, String(e));
      continue;
    }
    meld(
      "D1",
      taal,
      "de rapportbladen kunnen gebouwd worden",
      (rapport.paginas?.length ?? 0) > 0,
      `${rapport.paginas?.length ?? 0} bladen`,
    );

    try {
      const pdf = await pdfVanRapport(rapport);
      const kop = pdf.subarray(0, 5).toString("latin1");
      meld(
        "D2",
        taal,
        "er komt een echte PDF uit de keten",
        kop === "%PDF-" && pdf.length > 20000,
        `${kop}, ${Math.round(pdf.length / 1024)} kB`,
      );
    } catch (e) {
      meld("D2", taal, "er komt een echte PDF uit de keten", false, String(e));
    }
  }

  // De uitgeleverde frontend.
  for (const b of bundelBevindingen(wortel)) bevindingen.push(b);

  const gefaald = bevindingen.filter((b) => !b.geslaagd);
  const oordeel: Uitstuuroordeel = {
    ok: gefaald.length === 0,
    gecontroleerdOp: new Date().toISOString(),
    bevindingen,
    meldingen,
    geslaagd: bevindingen.length - gefaald.length,
    gefaald: gefaald.length,
  };
  if (oordeel.ok) bewaardOordeel = oordeel;
  return oordeel;
}

/**
 * De poort zoals de routes hem gebruiken. Levert null wanneer er niets in de
 * weg staat, en anders het antwoord dat de verzender hoort te krijgen.
 *
 * Alleen T4Students wordt getoetst. Elk ander instrument gaat ongewijzigd door,
 * zodat deze poort geen enkel bestaand pad kan hinderen.
 */
export async function poortVoorUitstuur(
  instrumentId: string | null | undefined,
  app?: Express | null,
  wortel?: string,
): Promise<{ status: number; lichaam: Record<string, unknown> } | null> {
  if (instrumentId !== "t4students") return null;
  let oordeel: Uitstuuroordeel;
  try {
    // wortel blijft leeg in bedrijf: dan kijkt de controle de werkelijk
    // uitgeleverde bouw van deze server na. De toetsen geven wel een wortel
    // mee, zodat hun uitslag niet afhangt van wat er toevallig in de werkmap
    // van de ontwikkelaar staat.
    oordeel = await keurUitstuurT4Students({ app, wortel });
  } catch (e) {
    return {
      status: 503,
      lichaam: {
        error:
          "De uitstuurcontrole van het studiekompas kon niet afgerond worden. Er is niets aangemaakt.",
        code: "T4S_UITSTUURCONTROLE_FOUT",
        detail: String(e),
      },
    };
  }
  if (oordeel.ok) return null;
  return {
    status: 503,
    lichaam: {
      error:
        "Het studiekompas is op dit ogenblik niet uitstuurbaar. De keten van invulscherm tot rapport is nagekeken en sluit niet. Er is geen uitnodiging aangemaakt en geen credit verbruikt.",
      code: "T4S_NIET_UITSTUURBAAR",
      gecontroleerdOp: oordeel.gecontroleerdOp,
      redenen: redenenVanWeigering(oordeel),
    },
  };
}

/** De redenen van een negatief oordeel, kort en leesbaar. */
export function redenenVanWeigering(oordeel: Uitstuuroordeel): string[] {
  return oordeel.bevindingen
    .filter((b) => !b.geslaagd)
    .map((b) => `${b.code}${b.taal ? ` (${b.taal})` : ""}: ${b.omschrijving}. ${b.detail ?? ""}`.trim());
}
