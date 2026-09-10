// ---------------------------------------------------------------------------
// shared/tapas-oog.ts
//
// Het Tapas-oog: de regels die bepalen of het oog straalt, en de tekening zelf.
// Eén bron van waarheid voor alle rapporten die het oog gebruiken (vandaag het
// T4P Business Kompas en het T4Students Studiekompas). Er staat hier geen enkele
// constructnaam en geen enkele rapporttekst: de aanroeper levert de constructen
// met hun rangorde, hun energiestatus en hun kleur aan.
//
// WAT HET OOG BEWEERT
// De ringen tonen potentieel: wat iemand naar voren brengt, in de rangorde
// waarin het naar voren komt. De STRALING zegt daar niets over. Zij zegt of dat
// potentieel er vandaag ook uit kan. Daarom kan de driverlaag het licht enkel
// dempen en nooit versterken: drivers zijn geen talent, maar het gedrag dat
// opkomt wanneer de omgeving spanning geeft. Kosten de twee dominantste drivers
// energie, dan gaat de aandacht naar het terugwinnen van controle en is er
// nauwelijks doorstroming naar het potentieel. Het oog hangt dan achter zware
// gordijnen: er blijft een spleet licht, want het talent is niet kleiner
// geworden, het is enkel amper bereikbaar.
//
// STATUS VAN DE GRENZEN
// Alle grenzen hieronder zijn conventies, in dezelfde lijn als de banden in
// shared/energie-schaal.ts. Zij zijn NIET geijkt op normdata en horen te worden
// herzien zodra die er zijn. De statusgrens tussen geeft, neutraal en kost komt
// uit energie-schaal.ts; er komt hier geen tweede grens bij.
// ---------------------------------------------------------------------------

import {
  ENERGIE_GRENZEN,
  energieBand,
  energieStatusVanGemiddelde,
  type EnergieBand,
  type EnergieStatusDrie,
} from "./energie-schaal";

// ── Invoer ──────────────────────────────────────────────────────────────────

export interface OogConstruct {
  /** Zoals hij in het instrument staat; wordt hier nooit hertaald. */
  naam: string;
  /** De energiestatus, of leeg wanneer er geen energie gemeten is. */
  status: EnergieStatusDrie | null;
  /** De identiteitskleur van dit construct in de ring. */
  kleur: string;
}

export interface OogInvoer {
  /** Talent-foci, in de rangorde van de rapportmotor (sterkste eerst). */
  foci: OogConstruct[];
  /** Talent-versnellers, in dezelfde rangorde-logica. */
  versnellers: OogConstruct[];
  /** Drivers, in de rangorde van de rapportmotor (dominantste eerst). */
  drivers: OogConstruct[];
}

// ── De regels ───────────────────────────────────────────────────────────────

/** Hoeveel smaller de laatste sector van een ring is dan de eerste. */
export const OOG_MINGEWICHT = 0.55;

/** Vier standen van de driverpoort. */
export type OogPoort = 0 | 1 | 2 | 3;

/** Vier stralingsniveaus. */
export type OogNiveau = 0 | 1 | 2 | 3;

export const OOG_NIVEAUNAAM: Record<OogNiveau, string> = {
  3: "vol stralend",
  2: "licht stralend",
  1: "gedempt",
  0: "amper stralend, achter zware gordijnen",
};

export const OOG_POORTNAAM: Record<OogPoort, string> = {
  3: "poort open",
  2: "poort half open",
  1: "poort knijpt",
  0: "poort dicht",
};

/** Hoe hard het licht brandt per niveau. Nul bestaat niet: op het laagste
 * niveau blijft een spleet licht achter de gordijnen. */
export const OOG_KRACHT: Record<OogNiveau, number> = { 3: 1, 2: 0.56, 1: 0.24, 0: 0.07 };

/**
 * De poort uit de statussen van de twee dominantste drivers. Alleen die twee
 * bepalen de poort: de eerste is de reflex die als eerste opkomt onder druk, de
 * tweede is de reserve die daarop volgt. Vallen die twee samen tegen, dan is er
 * geen derde die dat nog opvangt.
 */
export function oogPoort(drivers: OogConstruct[]): { stand: OogPoort; melding: string | null } {
  const gemeten = drivers.filter((d) => d.status !== null);
  if (gemeten.length < 2) {
    return {
      stand: 2,
      melding:
        "Er zijn minder dan twee drivers met gemeten energie. De poort blijft half open en de straling gaat niet hoger dan licht stralend.",
    };
  }
  const eerste = gemeten[0]!.status!;
  const tweede = gemeten[1]!.status!;
  const tabel: Record<string, OogPoort> = {
    "geeft|geeft": 3,
    "geeft|neutraal": 3,
    "geeft|kost": 2,
    "neutraal|geeft": 2,
    "neutraal|neutraal": 2,
    "neutraal|kost": 1,
    "kost|geeft": 1,
    // Kost enkel de eerste driver energie en is de tweede neutraal, dan hangen
    // de gordijnen niet: daarvoor moeten de twee dominantste drivers samen
    // energie kosten. De poort knijpt wel.
    "kost|neutraal": 1,
    "kost|kost": 0,
  };
  return { stand: tabel[`${eerste}|${tweede}`]!, melding: null };
}

/**
 * Het talentlicht: het rangordegewogen gemiddelde van de energie van de
 * talent-foci en de talent-versnellers samen, op de as min 1 tot plus 1. Het
 * gewicht van een construct is precies het gewicht dat ook de breedte van zijn
 * sector bepaalt, zodat wat het sterkst aanwezig is ook het zwaarst weegt.
 */
export function oogTalentlicht(invoer: OogInvoer): number | null {
  let teller = 0;
  let noemer = 0;
  const punt: Record<EnergieStatusDrie, number> = { geeft: 1, neutraal: 0, kost: -1 };
  for (const lijst of [invoer.foci, invoer.versnellers]) {
    const g = oogGewichten(lijst.length);
    lijst.forEach((c, i) => {
      if (c.status === null) return;
      teller += punt[c.status] * g[i]!;
      noemer += g[i]!;
    });
  }
  if (noemer === 0) return null;
  return teller / noemer;
}

/**
 * Van talentlicht naar band. De grenzen zijn de banden van energie-schaal.ts,
 * teruggerekend naar de as min 1 tot plus 1 zodat er geen tweede knipverdeling
 * ontstaat: hoog vanaf plus 0,50, stevig vanaf 0, wisselend vanaf min 0,40.
 */
export function oogTalentband(talentlicht: number): EnergieBand {
  return energieBand((talentlicht + 1) * 5);
}

export function oogTalentniveau(talentlicht: number): OogNiveau {
  const band = oogTalentband(talentlicht);
  if (band === "hoog") return 3;
  if (band === "stevig") return 2;
  if (band === "wisselend") return 1;
  return 0;
}

/**
 * De rem op de sterkste talenten. Kost een van de twee sterkste foci of een van
 * de twee sterkste versnellers zelf energie, dan gaat het oog nooit hoger dan
 * licht stralend: wat het meest van iemand gevraagd wordt, hoort niet het meest
 * te kosten.
 */
export function oogRem(invoer: OogInvoer): boolean {
  const top = [...invoer.foci.slice(0, 2), ...invoer.versnellers.slice(0, 2)];
  return top.some((c) => c.status === "kost");
}

export interface OogUitkomst {
  niveau: OogNiveau;
  niveauNaam: string;
  kracht: number;
  poort: OogPoort;
  poortNaam: string;
  talentlicht: number | null;
  talentband: EnergieBand | null;
  remActief: boolean;
  /** Hangen de zware gordijnen voor het licht? Dat is precies niveau 0. */
  gordijnen: boolean;
  alertKop: string;
  alertTekst: string;
  /** Wat de lezer moet weten over de gegevens waarop dit berust. */
  meldingen: string[];
}

const ALERT: Record<OogNiveau, { kop: string; tekst: string }> = {
  3: {
    kop: "Talent en context lopen samen",
    tekst:
      "De twee dominantste drivers geven energie en het talentlicht is hoog. Het potentieel komt naar buiten zonder dat het opgebracht moet worden.",
  },
  2: {
    kop: "Talent draagt, en er is iets dat aandacht vraagt",
    tekst:
      "Het talentlicht is er, maar de drivers of enkele van de sterkste talenten vragen energie. Dat is houdbaar, op voorwaarde dat de aandachtspunten benoemd worden.",
  },
  1: {
    kop: "Talent wordt opgebracht in plaats van gedragen",
    tekst:
      "Het potentieel is aanwezig, maar de dominantste drivers of de zwakke energie maken dat het inspanning kost om het te laten zien.",
  },
  0: {
    kop: "De aandacht gaat naar controle terugwinnen",
    tekst:
      "De twee dominantste drivers kosten energie. Vrijwel alle energie gaat dan naar het terugwinnen van controle over de situatie, waardoor er nauwelijks doorstroming is naar het potentieel. Het oog hangt achter zware gordijnen: er blijft een spleet licht, want het talent is niet kleiner geworden, het is enkel amper bereikbaar. Het gesprek gaat hier eerst over de context en de werkomstandigheden, en niet over het talent zelf.",
  },
};

/** De volledige beoordeling: talentlicht, poort, rem, niveau en alert. */
export function oogStraling(invoer: OogInvoer): OogUitkomst {
  const meldingen: string[] = [];
  const licht = oogTalentlicht(invoer);
  const poort = oogPoort(invoer.drivers);
  if (poort.melding) meldingen.push(poort.melding);

  const ongemetenDrivers = invoer.drivers.filter((d) => d.status === null).length;
  if (ongemetenDrivers > 0 && !poort.melding) {
    meldingen.push(
      "Bij minstens één driver is de energie niet gemeten. De poort berust dan op de drivers waarvan de energie wel gemeten is.",
    );
  }

  if (licht === null) {
    // Zonder gemeten energie wordt er niets beweerd. De terugvalwaarde uit
    // energie-schaal.ts mag hier niet dienen om alsnog een niveau te tonen: dan
    // zou een aanname als meting gelezen worden.
    meldingen.push(
      "Er is geen energie gemeten bij de talent-foci en de talent-versnellers. Het oog toont daarom de rangorde zonder straling.",
    );
    return {
      niveau: 0,
      niveauNaam: "zonder straling, energie niet gemeten",
      kracht: 0,
      poort: poort.stand,
      poortNaam: OOG_POORTNAAM[poort.stand],
      talentlicht: null,
      talentband: null,
      remActief: false,
      gordijnen: false,
      alertKop: "Energie niet gemeten",
      alertTekst:
        "Zonder gemeten energie zegt dit beeld enkel wat er aanwezig is, en niets over de vraag of het vandaag beschikbaar is.",
      meldingen,
    };
  }

  const rem = oogRem(invoer);
  let niveau = Math.min(oogTalentniveau(licht), poort.stand) as OogNiveau;
  if (poort.melding) niveau = Math.min(niveau, 2) as OogNiveau;
  if (rem) niveau = Math.min(niveau, 2) as OogNiveau;

  return {
    niveau,
    niveauNaam: OOG_NIVEAUNAAM[niveau],
    kracht: OOG_KRACHT[niveau],
    poort: poort.stand,
    poortNaam: OOG_POORTNAAM[poort.stand],
    talentlicht: licht,
    talentband: oogTalentband(licht),
    remActief: rem,
    gordijnen: niveau === 0,
    alertKop: ALERT[niveau].kop,
    alertTekst: ALERT[niveau].tekst,
    meldingen,
  };
}

/** De banden van energie-schaal.ts, teruggerekend naar de as van het
 * talentlicht. Bestaat om in tekst en test te kunnen tonen waar de grenzen
 * liggen zonder ze een tweede keer op te schrijven. */
export const OOG_TALENTGRENZEN = {
  hoog: ENERGIE_GRENZEN.hoog / 5 - 1,
  stevig: ENERGIE_GRENZEN.stevig / 5 - 1,
  wisselend: ENERGIE_GRENZEN.wisselend / 5 - 1,
} as const;

/** De status van een gemiddelde item-energie, of leeg wanneer er niets gemeten
 * is. Ligt hier zodat elke aanroeper van het oog dezelfde grens gebruikt. */
export function oogStatus(gemiddeldeItemEnergie: number | null | undefined): EnergieStatusDrie | null {
  if (gemiddeldeItemEnergie === null || gemiddeldeItemEnergie === undefined) return null;
  if (!Number.isFinite(gemiddeldeItemEnergie)) return null;
  return energieStatusVanGemiddelde(gemiddeldeItemEnergie);
}

// ── De tekening ─────────────────────────────────────────────────────────────
//
// De tekening komt hier als een lijst vormen, niet als SVG en niet als
// pdfkit-opdrachten. Zo tekenen het Kompas (HTML naar Chromium) en het
// Studiekompas (pdfkit) hetzelfde oog uit dezelfde meetkunde, terwijl elk zijn
// eigen motor blijft gebruiken. Padgegevens staan in SVG-notatie: pdfkit leest
// diezelfde notatie.

export type OogVorm =
  | { soort: "pad"; d: string; vul: string | null; rand: string | null; randbreedte: number; dekking?: number }
  | { soort: "cirkel"; cx: number; cy: number; r: number; vul: string | null; rand: string | null; randbreedte: number }
  | { soort: "gloed"; cx: number; cy: number; r: number; kleur: string; dekking: number }
  | { soort: "lijn"; x1: number; y1: number; x2: number; y2: number; kleur: string; breedte: number; dekking: number }
  | { soort: "tekst"; x: number; y: number; tekst: string; grootte: number; kleur: string; vet: boolean };

export interface OogTekening {
  breedte: number;
  hoogte: number;
  /** Het ooglid als pad. Dient ook als afsnijvlak voor alles binnenin. */
  lidPad: string;
  lidKleur: string;
  lidBreedte: number;
  /** Wat binnen het ooglid valt en dus afgesneden hoort te worden. */
  binnen: OogVorm[];
  /** Wat over het ooglid heen komt: de ringen, de pupil en de nummers. */
  voor: OogVorm[];
  /** De gordijnen, na de ringen en opnieuw binnen het afsnijvlak van het lid. */
  gordijn: OogVorm[];
  /**
   * Wat NA de gordijnen opnieuw getekend wordt: de nummers van de constructen.
   * De gordijnen dempen het licht, maar een half bedekt cijfer leest als een
   * fout in de druk. De nummers komen daarom in een lichte tint terug bovenop
   * de stof. Leeg wanneer er geen gordijnen hangen.
   */
  naGordijn: OogVorm[];
  uitkomst: OogUitkomst;
  /** De legende: nummer, naam en status per construct, in ringvolgorde. */
  legende: { nummer: string; naam: string; status: EnergieStatusDrie | null; kleur: string }[];
}

/** Lineair aflopende rangordegewichten: de eerste sector is de breedste. */
export function oogGewichten(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [1];
  return Array.from({ length: n }, (_, i) => 1 - (1 - OOG_MINGEWICHT) * (i / (n - 1)));
}

/** Diezelfde gewichten, omgerekend naar graden die samen 360 vullen. */
export function oogHoeken(n: number): number[] {
  const g = oogGewichten(n);
  const som = g.reduce((a, b) => a + b, 0);
  return g.map((x) => (x / som) * 360);
}

function mengKleur(hex: string, doel: [number, number, number], deel: number): string {
  const h = hex.replace("#", "");
  const rgb: [number, number, number] = [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
  const uit = rgb.map((v, i) => Math.round(v + (doel[i]! - v) * deel));
  return "#" + uit.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/**
 * De vulkleur van een sector. De identiteitskleur blijft herkenbaar; de energie
 * verandert de helderheid. Energie die geeft wordt lichter, energie die kost
 * wordt donkerder, en zonder meting blijft de sector open.
 */
export function oogVulling(kleur: string, status: EnergieStatusDrie | null): string {
  if (status === null) return "#ffffff";
  if (status === "geeft") return mengKleur(kleur, [255, 255, 255], 0.58);
  if (status === "neutraal") return mengKleur(kleur, [255, 255, 255], 0.24);
  return mengKleur(kleur, [0, 0, 0], 0.4);
}

/** Het grijs van een driverwig: hoe donkerder, hoe meer die driver kost. */
function driverGrijs(status: EnergieStatusDrie | null): number {
  if (status === "geeft") return 205;
  if (status === "neutraal") return 150;
  if (status === "kost") return 92;
  return 232;
}

/** Een reeks tinten van dezelfde basiskleur, voor een ring zonder eigen
 * identiteitskleuren per construct. */
export function oogTintReeks(basis: string, n: number): string[] {
  if (n <= 1) return [basis];
  return Array.from({ length: n }, (_, i) => mengKleur(basis, [255, 255, 255], (i / (n - 1)) * 0.52));
}

const OOG_TEAL = "#1b5e5a";
const OOG_GRIJS = "#6e6a62";
const OOG_INKT = "#23211d";
/** De tint van de nummers die bovenop de gordijnstof terugkomen. */
const OOG_GORDIJN_TEKST = "#e6e1d6";
const OOG_LICHT = "#e0a82e";
const OOG_GLOED = "#ffc553";

function sectorPad(
  cx: number,
  cy: number,
  rBinnen: number,
  rBuiten: number,
  hoek0: number,
  hoek1: number,
): string {
  const punt = (r: number, h: number): [number, number] => {
    const ra = (h * Math.PI) / 180;
    return [cx + r * Math.sin(ra), cy - r * Math.cos(ra)];
  };
  const groot = hoek1 - hoek0 > 180 ? 1 : 0;
  const [x0, y0] = punt(rBuiten, hoek0);
  const [x1, y1] = punt(rBuiten, hoek1);
  const [x2, y2] = punt(rBinnen, hoek1);
  const [x3, y3] = punt(rBinnen, hoek0);
  const n = (v: number) => v.toFixed(2);
  if (rBinnen <= 0.01) {
    return `M ${n(cx)} ${n(cy)} L ${n(x0)} ${n(y0)} A ${n(rBuiten)} ${n(rBuiten)} 0 ${groot} 1 ${n(x1)} ${n(y1)} Z`;
  }
  return (
    `M ${n(x0)} ${n(y0)} A ${n(rBuiten)} ${n(rBuiten)} 0 ${groot} 1 ${n(x1)} ${n(y1)} ` +
    `L ${n(x2)} ${n(y2)} A ${n(rBinnen)} ${n(rBinnen)} 0 ${groot} 0 ${n(x3)} ${n(y3)} Z`
  );
}

/**
 * Bouwt de volledige tekening in een vak van breedte bij hoogte. De maten
 * volgen de gemeten verhoudingen van het bestaande oog: het ooglid is een lens
 * van 2,06 bij 1,52 keer de straal, de versnellers liggen op 0,63 tot 0,955 en
 * de foci op 0,34 tot 0,585 van de straal, met de kleurband erbuiten, en de
 * drivers vullen de pupil tot 0,315.
 */
export function oogTekening(invoer: OogInvoer, breedte: number, hoogte: number): OogTekening {
  const uitkomst = oogStraling(invoer);
  const kracht = uitkomst.kracht;
  const cx = breedte / 2;
  const cy = hoogte / 2;
  const R = Math.min(breedte / 4.25, hoogte / 3.06);
  const sc = R / 150;
  const lensB = R * 2.06;
  const lensH = R * 1.52;

  const nn = (v: number) => v.toFixed(1);
  const lidPad =
    `M ${nn(cx - lensB)} ${nn(cy)} ` +
    `C ${nn(cx - lensB * 0.62)} ${nn(cy - lensH)} ${nn(cx + lensB * 0.62)} ${nn(cy - lensH)} ${nn(cx + lensB)} ${nn(cy)} ` +
    `C ${nn(cx + lensB * 0.62)} ${nn(cy + lensH)} ${nn(cx - lensB * 0.62)} ${nn(cy + lensH)} ${nn(cx - lensB)} ${nn(cy)} Z`;

  const binnen: OogVorm[] = [];
  const voor: OogVorm[] = [];
  const gordijn: OogVorm[] = [];
  const legende: OogTekening["legende"] = [];

  // Het licht. Ook op het laagste niveau blijft er een rest, want het talent is
  // niet verdwenen; het is enkel amper bereikbaar.
  if (kracht > 0) {
    for (const [factor, dekking] of [
      [2.35, 0.16],
      [1.85, 0.2],
      [1.45, 0.26],
    ] as [number, number][]) {
      binnen.push({ soort: "gloed", cx, cy, r: R * factor, kleur: OOG_GLOED, dekking: dekking * kracht });
    }
    for (let i = 0; i < 36; i++) {
      const a = ((i * 10 + 5) * Math.PI) / 180;
      const lang = R * (1.1 + 1.0 * kracht);
      binnen.push({
        soort: "lijn",
        x1: cx + R * 1.05 * Math.cos(a),
        y1: cy + R * 1.05 * Math.sin(a),
        x2: cx + lang * Math.cos(a),
        y2: cy + lang * Math.sin(a),
        kleur: OOG_LICHT,
        breedte: 2.6 * sc,
        dekking: 0.16 + 0.58 * kracht,
      });
    }
  }

  // De twee talentringen. De buitenste ring is de inzetlaag, de binnenste de
  // aandachtslaag; elke ring draagt buiten zich haar identiteitskleur.
  const ringen: [OogConstruct[], number, number, number, string][] = [
    [invoer.versnellers, 0.63, 0.955, 1.0, "V"],
    [invoer.foci, 0.34, 0.585, 0.625, "F"],
  ];
  for (const [lijst, rIn, rUit, band, letter] of ringen) {
    const hoeken = oogHoeken(lijst.length);
    let a = 0;
    lijst.forEach((c, i) => {
      const hoek = hoeken[i]!;
      voor.push({
        soort: "pad",
        d: sectorPad(cx, cy, R * rIn, R * rUit, a, a + hoek),
        vul: oogVulling(c.kleur, c.status),
        rand: "#ffffff",
        randbreedte: 1.8 * sc,
      });
      voor.push({
        soort: "pad",
        d: sectorPad(cx, cy, R * rUit, R * band, a, a + hoek),
        vul: c.kleur,
        rand: null,
        randbreedte: 0,
      });
      const mid = ((a + hoek / 2) * Math.PI) / 180;
      const rMid = (R * (rIn + rUit)) / 2;
      voor.push({
        soort: "tekst",
        x: cx + rMid * Math.sin(mid),
        y: cy - rMid * Math.cos(mid),
        tekst: `${letter}${i + 1}`,
        grootte: 12.5 * sc,
        kleur: c.status === "kost" ? "#ffffff" : OOG_INKT,
        vet: true,
      });
      legende.push({ nummer: `${letter}${i + 1}`, naam: c.naam, status: c.status, kleur: c.kleur });
      a += hoek;
    });
  }

  // De drivers in de pupil: geen identiteitskleur, want zij zijn geen talent.
  // Hoe donkerder de wig, hoe meer die driver vandaag kost.
  {
    const hoeken = oogHoeken(invoer.drivers.length);
    let a = 0;
    invoer.drivers.forEach((c, i) => {
      const t = driverGrijs(c.status);
      const grijs = "#" + [t, t, t].map((v) => v.toString(16).padStart(2, "0")).join("");
      voor.push({
        soort: "pad",
        d: sectorPad(cx, cy, 0, R * 0.315, a, a + hoeken[i]!),
        vul: grijs,
        rand: "#ffffff",
        randbreedte: 1.3 * sc,
      });
      const mid = ((a + hoeken[i]! / 2) * Math.PI) / 180;
      voor.push({
        soort: "tekst",
        x: cx + R * 0.2 * Math.sin(mid),
        y: cy - R * 0.2 * Math.cos(mid),
        tekst: `D${i + 1}`,
        grootte: 12.5 * sc,
        kleur: t < 150 ? "#ffffff" : OOG_INKT,
        vet: true,
      });
      legende.push({ nummer: `D${i + 1}`, naam: c.naam, status: c.status, kleur: grijs });
      a += hoeken[i]!;
    });
    voor.push({ soort: "cirkel", cx, cy, r: R * 0.315, vul: null, rand: OOG_INKT, randbreedte: 2.4 * sc });
  }

  // De zware gordijnen. Zij hangen VOOR het hele beeld en niet enkel voor de
  // eerste laag: kosten de twee dominantste drivers energie, dan is het hele
  // potentieel amper inzetbaar. In het midden blijft een spleet open, want het
  // talent staat er nog volledig; het is enkel amper bereikbaar.
  if (uitkomst.gordijnen) {
    const spleet = R * 0.16;
    const nnn = (v: number) => v.toFixed(1);
    for (const kant of [-1, 1] as const) {
      const buiten = cx + kant * lensB * 1.02;
      const binnenrand = cx + kant * spleet;
      const x0 = Math.min(buiten, binnenrand);
      const x1 = Math.max(buiten, binnenrand);
      gordijn.push({
        soort: "pad",
        d:
          `M ${nnn(x0)} ${nnn(cy - lensH * 1.02)} L ${nnn(x1)} ${nnn(cy - lensH * 1.02)} ` +
          `L ${nnn(x1)} ${nnn(cy + lensH * 1.02)} L ${nnn(x0)} ${nnn(cy + lensH * 1.02)} Z`,
        vul: "#23211d",
        rand: null,
        randbreedte: 0,
        // Doorschijnend, niet dekkend: het talent blijft vaag zichtbaar achter
        // de stof. Wie er tegenaan kijkt ziet dat er iets is, maar niet wat.
        dekking: 0.74,
      });
    }
    // De vouwen van de stof, zodat het ook zwart op wit als een gordijn leest
    // en niet als een fout in de druk.
    const stap = R * 0.17;
    for (let x = cx - lensB; x <= cx + lensB; x += stap) {
      if (Math.abs(x - cx) < spleet) continue;
      gordijn.push({
        soort: "lijn",
        x1: x,
        y1: cy - lensH * 1.02,
        x2: x,
        y2: cy + lensH * 1.02,
        kleur: "#000000",
        breedte: 1.4 * sc,
        dekking: 0.5,
      });
    }
  }

  return {
    breedte,
    hoogte,
    lidPad,
    lidKleur: uitkomst.gordijnen ? OOG_GRIJS : OOG_TEAL,
    lidBreedte: 9 * sc,
    binnen,
    voor,
    gordijn,
    naGordijn: uitkomst.gordijnen
      ? [...binnen, ...voor]
          .filter((v) => v.soort === "tekst")
          .map((v) => ({ ...v, kleur: OOG_GORDIJN_TEKST }))
      : [],
    uitkomst,
    // De legende leest in de volgorde waarin het rapport de lagen benoemt:
    // eerst de foci, dan de versnellers, dan de drivers. De ringen worden van
    // buiten naar binnen getekend, dus die twee volgordes zijn niet dezelfde.
    legende: [
      ...legende.filter((l) => l.nummer.startsWith("F")),
      ...legende.filter((l) => l.nummer.startsWith("V")),
      ...legende.filter((l) => l.nummer.startsWith("D")),
    ],
  };
}

/** Het woord bij een status, voor de legende. */
export const OOG_STATUSWOORD: Record<string, string> = {
  geeft: "geeft energie",
  neutraal: "energieneutraal",
  kost: "kost energie",
  onbekend: "energie niet gemeten",
};

export function oogStatuswoord(status: EnergieStatusDrie | null): string {
  return OOG_STATUSWOORD[status ?? "onbekend"]!;
}

/** Hetzelfde woord, kort, voor een smalle legendekolom. */
export const OOG_STATUSWOORD_KORT: Record<string, string> = {
  geeft: "geeft",
  neutraal: "neutraal",
  kost: "kost",
  onbekend: "niet gemeten",
};

export function oogStatuswoordKort(status: EnergieStatusDrie | null): string {
  return OOG_STATUSWOORD_KORT[status ?? "onbekend"]!;
}
