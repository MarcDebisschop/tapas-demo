// ---------------------------------------------------------------------------
// server/notulen-toc/herkennen.ts  -  NIEUW BESTAND
//
// Stap twee van de omzetting: de blokken uit het geüploade bestand worden de
// inhoud van een verslag volgens het vaste model.
//
// Het uitgangspunt is dat beknopte notulen los geschreven zijn. Er staat geen
// vaste structuur in, er staan koppen in eigen woorden, en de helft van de
// afspraken staat in een halve zin. De herkenning werkt daarom op twee sporen
// tegelijk:
//
//   1. de rubriek waarin een regel staat, uit de koppen ("Governance",
//      "Financieel", "Acties");
//   2. wat de regel zelf zegt, uit haar eerste woorden ("Besluit:", "Actie:",
//      "Risico:", "Aanwezig:").
//
// Het tweede spoor weegt zwaarder dan het eerste: een regel die met "Besluit:"
// begint, is een besluit, ook wanneer ze onder de kop "Financieel" staat. Het
// thema van dat besluit komt dan wel uit de kop.
//
// Eén regel is onvoorwaardelijk: niets verdwijnt. Wat de herkenning niet met
// zekerheid kan plaatsen, gaat naar nietGeplaatst en komt achteraan het verslag
// op papier, met een kop die zegt dat die regels een plaats moeten krijgen. Een
// stille verdwijning in een verslag naar een investeerder is erger dan een
// zichtbaar restje.
// ---------------------------------------------------------------------------
import type { Ingelezen, Tabel } from "./inlezen";
import {
  KERNVELDEN,
  THEMAS,
  THEMA_LETTERS,
  leegVerslag,
  type Actie,
  type Besluit,
  type Kernveld,
  type Omzetrapport,
  type ThemaLetter,
  type VerslagInhoud,
} from "./model";

// ---------------------------------------------------------------------------
// Woordenlijsten.
// ---------------------------------------------------------------------------
type Sectie =
  | { soort: "kern" }
  | { soort: "doel" }
  | { soort: "kernboodschap" }
  | { soort: "vorig" }
  | { soort: "thema"; letter: ThemaLetter }
  | { soort: "besluiten" }
  | { soort: "acties" }
  | { soort: "open" }
  | { soort: "risicos" }
  | { soort: "vragen" }
  | { soort: "werkafspraken" }
  | { soort: "goedkeuring" }
  | { soort: "bijlagen" };

/** Rubriekkoppen. De eerste treffer in deze orde wint, dus specifiek vóór algemeen. */
const RUBRIEK_WOORDEN: Array<[Sectie, string[]]> = [
  [{ soort: "vorig" }, ["vorig verslag", "vorige vergadering", "opvolging van de acties", "opvolging acties", "opvolging"]],
  [{ soort: "kernboodschap" }, ["kernboodschap", "samenvatting", "executive summary", "kernpunten", "hoofdlijnen", "in een oogopslag"]],
  [{ soort: "kern" }, ["kerngegevens", "vergadergegevens", "praktisch", "aanwezigheden", "administratief"]],
  [{ soort: "doel" }, ["doel en leeswijzer", "leeswijzer", "doel van", "inleiding", "situering", "aanleiding"]],
  [{ soort: "besluiten" }, ["besluitenregister", "besluitenlijst", "besluiten", "beslissingen", "genomen besluiten"]],
  [{ soort: "acties" }, ["actieregister", "actielijst", "actiepunten", "acties", "to do", "todo", "wie doet wat"]],
  [{ soort: "open" }, ["openstaande punten", "open punten", "te nemen beslissingen", "nog te beslissen", "openstaand"]],
  [{ soort: "risicos" }, ["risico", "risicos", "risico's", "beheersmaatregelen", "bedreigingen"]],
  [{ soort: "vragen" }, ["vraag aan", "vragen aan", "verwachting richting", "vraag en verwachting", "vragen voor pmv", "vragen"]],
  [{ soort: "werkafspraken" }, ["werkafspraken", "vergaderkalender", "kalender", "afspraken over de samenwerking", "praktische afspraken"]],
  [{ soort: "goedkeuring" }, ["goedkeuring", "ondertekening", "voor akkoord"]],
  [{ soort: "bijlagen" }, ["bijlagen", "bijlage"]],
];

/** Themawoorden. Alleen gebruikt wanneer geen rubriekkop past. */
const THEMA_WOORDEN: Array<[ThemaLetter, string[]]> = [
  ["A", ["platform", "technologie", "techniek", "software", "demo", "release", "sparklink", "ontwikkeling", "it", "ict", "hardware"]],
  ["B", ["psychometrie", "psychometrisch", "validiteit", "betrouwbaarheid", "academisch", "academische", "wetenschap", "onderbouwing", "professor", "normering"]],
  ["C", ["commercie", "commercieel", "klanten", "klant", "verkoop", "omzetgroei", "groei", "pijplijn", "sales", "prospect", "opdrachten", "markt"]],
  ["D", ["organisatie", "rollen", "governance", "bestuur", "raad van bestuur", "vennootschap", "mandaat", "mandaten", "back-office", "backoffice", "aanwerving", "structuur", "personeel", "medewerkers", "coo", "rvb", "samenstelling", "aandeelhouders", "aandeelhouder", "kapitaal", "statuten"]],
  ["E", ["coachnetwerk", "coaches", "coach", "kwaliteitsbewaking", "licentie", "licentiering", "netwerk", "facilitatoren", "facilitator"]],
  ["F", ["academy", "opleiding", "vorming", "certificering", "training", "leergang"]],
  ["G", ["merk", "merkbescherming", "positionering", "branding", "marketing", "huisstijl", "website", "naamgeving", "communicatie naar de markt", "brand", "merknaam"]],
  ["H", ["financien", "financieel", "financiele", "facturatie", "factuur", "rapportering", "boekhouding", "budget", "cashflow", "p&l", "resultatenrekening", "omzet"]],
  ["I", ["samenwerking", "team of captains", "toc", "bereikbaarheid", "overlegritme", "onderling", "werkwijze", "swot", "spoc", "aanspreekpunt"]],
];

/** Kerngegevens: sleutelwoorden per veld, langste eerst zodat "datum en uur" voorgaat. */
const KERN_WOORDEN: Array<[Kernveld, string[]]> = [
  ["datumEnUur", ["datum en uur", "datum en tijd", "datum", "dag", "wanneer", "tijdstip", "uur"]],
  ["volgende", ["volgende vergadering", "volgend overleg", "volgende meeting", "volgende bijeenkomst", "eerstvolgende"]],
  ["vergadering", ["vergadering", "overleg", "meeting", "bijeenkomst", "onderwerp"]],
  ["locatie", ["locatie", "plaats", "zaal", "waar"]],
  ["voorzitter", ["voorzitter"]],
  ["verslaggever", ["verslaggever", "verslag opgemaakt door", "verslag door", "notulist", "opgemaakt door", "auteur", "verslag"]],
  ["aanwezig", ["aanwezig", "aanwezigen", "deelnemers", "present"]],
  ["verontschuldigd", ["verontschuldigd", "verontschuldigingen", "afwezig", "afwezigen"]],
  ["gast", ["gast", "gasten", "genodigde", "genodigden"]],
  ["verspreiding", ["verspreiding", "distributie", "bestemmeling", "bestemmelingen"]],
  ["status", ["status van dit verslag", "status"]],
  ["vertrouwelijkheid", ["vertrouwelijkheid", "vertrouwelijk"]],
];

const MAANDEN: Record<string, string> = {
  januari: "01", jan: "01",
  februari: "02", feb: "02",
  maart: "03", mrt: "03",
  april: "04", apr: "04",
  mei: "05",
  juni: "06", jun: "06",
  juli: "07", jul: "07",
  augustus: "08", aug: "08",
  september: "09", sep: "09", sept: "09",
  oktober: "10", okt: "10",
  november: "11", nov: "11",
  december: "12", dec: "12",
};

const NIETS_BEPAALD = "nog te bepalen";

// ---------------------------------------------------------------------------
// Hulpmiddelen.
// ---------------------------------------------------------------------------

/** Kleine letters, zonder leestekens vooraan, zonder nummering, zonder accenten. */
function normaliseer(ruw: string): string {
  return ruw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^[\s>*\u2022\-\u00b7]+/, "")
    .replace(/^\(?\d{1,2}[\.\)]?(\d{1,2})?[\.\)]?\s+/, "")
    .replace(/^[a-i][\.\)]\s+/, "")
    .replace(/[:;.]+$/, "")
    .trim();
}

function bevatWoord(genormaliseerd: string, woorden: string[]): boolean {
  return woorden.some((w) => genormaliseerd.includes(w));
}

/** Kop naar rubriek of thema. Null wanneer de kop niets van het model raakt. */
function sectieVanKop(tekst: string): Sectie | null {
  const n = normaliseer(tekst);
  if (n === "") return null;
  for (const [sectie, woorden] of RUBRIEK_WOORDEN) {
    if (bevatWoord(n, woorden)) return sectie;
  }
  for (const [letter, woorden] of THEMA_WOORDEN) {
    if (bevatWoord(n, woorden)) return { soort: "thema", letter };
  }
  return null;
}

/**
 * Is deze alinea een kop? Een kopstijl is zeker. Verder geldt: kort, vet of een
 * regel die op een dubbele punt eindigt zonder er tekst achter te hebben, en
 * geen zin met een punt erin. Een opsommingsregel is nooit een kop.
 */
function isKop(tekst: string, vet: boolean, opsomming: boolean, kopniveau: number): boolean {
  if (opsomming) return false;
  if (kopniveau > 0) return true;
  const woorden = tekst.trim().split(/\s+/).length;
  if (woorden > 9) return false;
  if (/[.!?]\s*$/.test(tekst)) return false;
  if (tekst.trim().endsWith(":")) return true;
  return vet;
}

/** Sleutel en waarde uit een regel van de vorm "Aanwezig: Marc, Herman". */
function kernuitRegel(tekst: string): [Kernveld, string] | null {
  const m = tekst.match(/^\s*([A-Za-zÀ-ÿ'\s]{3,40}?)\s*[:\u2236]\s*(.+)$/);
  if (!m) return null;
  const sleutel = normaliseer(m[1]);
  const waarde = m[2].trim();
  if (waarde === "") return null;
  const veld = kernveldVanSleutel(sleutel);
  return veld ? [veld, waarde] : null;
}

function kernveldVanSleutel(genormaliseerd: string): Kernveld | null {
  for (const [veld, woorden] of KERN_WOORDEN) {
    if (woorden.some((w) => genormaliseerd === w)) return veld;
  }
  for (const [veld, woorden] of KERN_WOORDEN) {
    if (woorden.some((w) => genormaliseerd.startsWith(w) || genormaliseerd.endsWith(w))) return veld;
  }
  return null;
}

/** Datum in dd.mm.jjjj, of de oorspronkelijke tekst wanneer er geen datum in staat. */
export function leesDatum(ruw: string): string {
  const t = ruw.trim();
  if (t === "") return "";
  const cijfers = t.match(/(\d{1,2})\s*[\.\/\-]\s*(\d{1,2})\s*[\.\/\-]\s*(\d{2,4})/);
  if (cijfers) {
    const dag = cijfers[1].padStart(2, "0");
    const maand = cijfers[2].padStart(2, "0");
    const jaar = cijfers[3].length === 2 ? `20${cijfers[3]}` : cijfers[3];
    return `${dag}.${maand}.${jaar}`;
  }
  const metMaand = t
    .toLowerCase()
    .match(/(\d{1,2})\s+([a-z]+)\.?\s*(\d{4})?/);
  if (metMaand) {
    const maand = MAANDEN[metMaand[2]];
    if (maand) {
      const dag = metMaand[1].padStart(2, "0");
      const jaar = metMaand[3] ?? String(new Date().getFullYear());
      return `${dag}.${maand}.${jaar}`;
    }
  }
  return t;
}

interface Kenmerken {
  tekst: string;
  eigenaar: string;
  deadline: string;
  prioriteit: string;
}

/**
 * Haalt eigenaar, datum en prioriteit uit een actieregel en levert de regel
 * zonder die stukken terug. Werkt op de vormen die in beknopte notulen voorkomen:
 *
 *   Actie: organogram opmaken (Marc) tegen 30.09.2026, hoog
 *   Organogram opmaken. Eigenaar: Marc. Deadline: 30 september 2026.
 */
function leesKenmerken(ruw: string): Kenmerken {
  let tekst = ruw;
  let eigenaar = "";
  let deadline = "";
  let prioriteit = "";

  const eigenaarPatroon = /\b(eigenaar|verantwoordelijke|owner|trekker|wie)\s*[:=]\s*([^,.;()]+)/i;
  const mEig = tekst.match(eigenaarPatroon);
  if (mEig) {
    eigenaar = mEig[2].trim();
    tekst = tekst.replace(mEig[0], " ");
  }

  const datumPatroon = /\b(deadline|tegen|voor|datum|klaar tegen|uiterlijk)\s*[:=]?\s*([0-3]?\d\s*[\.\/\-]\s*[01]?\d\s*[\.\/\-]\s*\d{2,4}|[0-3]?\d\s+[a-zA-Zà-ÿ]+\.?\s*\d{0,4}|nog te bepalen|ntb)/i;
  const mDat = tekst.match(datumPatroon);
  if (mDat) {
    const ruweDatum = mDat[2].trim();
    deadline = /^(nog te bepalen|ntb)$/i.test(ruweDatum) ? NIETS_BEPAALD : leesDatum(ruweDatum);
    tekst = tekst.replace(mDat[0], " ");
  } else {
    const losseDatum = tekst.match(/\b([0-3]?\d\s*[\.\/\-]\s*[01]?\d\s*[\.\/\-]\s*\d{2,4})\b/);
    if (losseDatum) {
      deadline = leesDatum(losseDatum[1]);
      tekst = tekst.replace(losseDatum[0], " ");
    }
  }

  if (/\b(hoog|urgent|dringend|blokkeert|prioritair)\b/i.test(tekst)) prioriteit = "hoog";
  else if (/\b(laag|kan wachten)\b/i.test(tekst)) prioriteit = "laag";
  tekst = tekst.replace(/\b(prioriteit)\s*[:=]\s*(hoog|normaal|laag)\b/gi, " ");
  // Een los prioriteitswoord achteraan de regel is nu in de kolom opgenomen en
  // hoort niet meer in de tekst. Het moet weg vóór de eigenaar gezocht wordt,
  // anders staat het tussen de naam en het einde van de regel.
  tekst = tekst.replace(/[,;]?\s*\b(hoog|urgent|dringend|prioritair|normaal|laag)\b\s*[.,;]?\s*$/i, " ");
  tekst = tekst.replace(/\s{2,}/g, " ").replace(/[\s,;]+$/, "").trim();

  if (eigenaar === "") {
    const achteraan = tekst.match(/\(([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'\s\.]{1,28})\)\s*[.,;]?\s*$/);
    if (achteraan) {
      const kandidaat = achteraan[1].trim();
      if (!/\d/.test(kandidaat) && kandidaat.split(/\s+/).length <= 4) {
        eigenaar = kandidaat;
        tekst = tekst.replace(achteraan[0], " ");
      }
    }
  }

  tekst = tekst
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/[\s,;]+$/, "")
    .trim();
  if (tekst !== "" && !/[.!?]$/.test(tekst)) tekst = `${tekst}.`;

  return {
    tekst,
    eigenaar: eigenaar === "" ? NIETS_BEPAALD : eigenaar,
    deadline: deadline === "" ? NIETS_BEPAALD : deadline,
    prioriteit: prioriteit === "" ? "normaal" : prioriteit,
  };
}

/** Verwijdert een leidend etiket ("Besluit:", "Actie", "Risico -") van een regel. */
function zonderEtiket(tekst: string, etiket: RegExp): string {
  return tekst.replace(etiket, "").replace(/^\s*[:\-\u2022]\s*/, "").trim();
}

const ETIKET_BESLUIT = /^\s*(besluit(en)?|beslissing|beslist|we beslissen|decision)\b\s*[:\-]?\s*/i;
const ETIKET_ACTIE = /^\s*(actie(punt)?|to\s?do|todo|te doen|task|opdracht)\b\s*[:\-]?\s*/i;
const ETIKET_RISICO = /^\s*(risico|bedreiging|gevaar)\b\s*[:\-]?\s*/i;
const ETIKET_VRAAG = /^\s*(vraag|vragen)\b\s*(aan\s+\w+)?\s*[:\-]?\s*/i;
const ETIKET_OPEN = /^\s*(openstaand(e)?( punt)?|open punt|nog te beslissen|onbeslist|openstaand)\b\s*[:\-]?\s*/i;
const ETIKET_AFSPRAAK = /^\s*(werkafspraak|afspraak)\b\s*[:\-]?\s*/i;
const ETIKET_BIJLAGE = /^\s*bijlage\s*\d*\s*[:\-]?\s*/i;
const ETIKET_STAND = /^\s*(stand van zaken|stand|situatie|vaststelling)\b\s*[:\-]?\s*/i;

// ---------------------------------------------------------------------------
// De herkenning zelf.
// ---------------------------------------------------------------------------

export interface Herkenning {
  inhoud: VerslagInhoud;
  rapport: Omzetrapport;
}

export function herken(ingelezen: Ingelezen, bestandsnaam: string): Herkenning {
  const inhoud = leegVerslag();
  const aandacht: string[] = [];

  let sectie: Sectie | null = null;
  let laatsteThema: ThemaLetter | null = null;
  let regelsVoorEersteKop = 0;

  // Beknopte notulen beginnen bijna altijd met een paar losse regels bovenaan:
  // de naam van het overleg, de datum met het uur, de plaats. Die regels dragen
  // geen dubbele punt en zouden anders als kop gelezen worden. "Team of Captains
  // Meeting" zou dan het thema Samenwerking openen in plaats van de titel van de
  // vergadering te worden. Deze voorpas neemt die kopregels eerst weg.
  const opgenomen = voorpasKerngegevens(ingelezen, inhoud);

  const themaLabel = (letter: ThemaLetter | null): string => {
    if (!letter) return "algemeen";
    const t = THEMAS.find((x) => x.letter === letter);
    return t ? `${t.letter}. ${t.titel}` : "algemeen";
  };

  const voegBesluitToe = (tekst: string, eigenaar?: string): void => {
    const k = leesKenmerken(tekst);
    inhoud.besluiten.push({
      nr: "",
      tekst: k.tekst,
      thema: themaLabel(laatsteThema),
      eigenaar: eigenaar && eigenaar !== "" ? eigenaar : k.eigenaar,
    });
    if (laatsteThema) inhoud.themas[laatsteThema].besluiten.push(k.tekst);
  };

  const voegActieToe = (tekst: string): void => {
    const k = leesKenmerken(tekst);
    inhoud.acties.push({
      nr: "",
      tekst: k.tekst,
      eigenaar: k.eigenaar,
      deadline: k.deadline,
      prioriteit: k.prioriteit,
    });
  };

  /**
   * Plaatst één regel. Eerst op wat de regel zelf zegt, dan op de rubriek waarin
   * ze staat. Levert false wanneer de regel nergens thuishoort.
   */
  const plaatsRegel = (ruw: string, opsomming: boolean): boolean => {
    const tekst = ruw.trim();
    if (tekst === "") return true;

    // Spoor één: het etiket vooraan de regel.
    if (ETIKET_BESLUIT.test(tekst)) {
      const kern = zonderEtiket(tekst, ETIKET_BESLUIT);
      if (kern !== "") {
        voegBesluitToe(kern);
        return true;
      }
    }
    if (ETIKET_ACTIE.test(tekst)) {
      const kern = zonderEtiket(tekst, ETIKET_ACTIE);
      if (kern !== "") {
        voegActieToe(kern);
        return true;
      }
    }
    if (ETIKET_RISICO.test(tekst)) {
      const kern = zonderEtiket(tekst, ETIKET_RISICO);
      if (kern !== "") {
        inhoud.risicos.push({ risico: kern, gevolg: NIETS_BEPAALD, maatregel: NIETS_BEPAALD, eigenaar: NIETS_BEPAALD });
        return true;
      }
    }
    if (ETIKET_OPEN.test(tekst)) {
      const kern = zonderEtiket(tekst, ETIKET_OPEN);
      if (kern !== "") {
        inhoud.openPunten.push({ punt: kern, ontbreekt: NIETS_BEPAALD, terug: "volgende vergadering" });
        return true;
      }
    }
    if (ETIKET_BIJLAGE.test(tekst)) {
      const kern = zonderEtiket(tekst, ETIKET_BIJLAGE);
      if (kern !== "") {
        inhoud.bijlagen.push(kern);
        return true;
      }
    }
    if (ETIKET_AFSPRAAK.test(tekst)) {
      const kern = zonderEtiket(tekst, ETIKET_AFSPRAAK);
      if (kern !== "") {
        inhoud.werkafspraken.push(kern);
        return true;
      }
    }
    if (/^\s*(vraag|vragen)\b/i.test(tekst) && /\b(pmv|investeerder|partner|aandeelhouder|roald)\b/i.test(tekst)) {
      const kern = zonderEtiket(tekst, ETIKET_VRAAG);
      if (kern !== "") {
        inhoud.vragen.push({ vraag: kern, waarom: NIETS_BEPAALD, tegen: NIETS_BEPAALD });
        return true;
      }
    }

    // Kerngegevens staan vaak als losse regel met een dubbele punt.
    const kern = kernuitRegel(tekst);
    if (kern) {
      const [veld, waarde] = kern;
      if (inhoud.kerngegevens[veld] === undefined) inhoud.kerngegevens[veld] = waarde;
      return true;
    }

    // Spoor twee: de rubriek waarin de regel staat.
    const huidig: Sectie = sectie ?? { soort: "doel" };
    if (sectie === null) regelsVoorEersteKop += 1;

    switch (huidig.soort) {
      case "kern":
        return false;
      case "doel":
        inhoud.doel.push(tekst);
        return true;
      case "kernboodschap":
        inhoud.kernboodschap.push(tekst);
        return true;
      case "vorig":
        inhoud.vaststellingVorigVerslag.push(tekst);
        return true;
      case "thema": {
        const blok = inhoud.themas[huidig.letter];
        if (ETIKET_STAND.test(tekst)) {
          const zonder = zonderEtiket(tekst, ETIKET_STAND);
          if (zonder !== "") blok.stand.push(zonder);
          return true;
        }
        if (blok.stand.length === 0 && !opsomming) blok.stand.push(tekst);
        else blok.bespreking.push(tekst);
        return true;
      }
      case "besluiten":
        voegBesluitToe(tekst);
        return true;
      case "acties":
        voegActieToe(tekst);
        return true;
      case "open":
        inhoud.openPunten.push({ punt: tekst, ontbreekt: NIETS_BEPAALD, terug: "volgende vergadering" });
        return true;
      case "risicos":
        inhoud.risicos.push({ risico: tekst, gevolg: NIETS_BEPAALD, maatregel: NIETS_BEPAALD, eigenaar: NIETS_BEPAALD });
        return true;
      case "vragen":
        inhoud.vragen.push({ vraag: zonderEtiket(tekst, ETIKET_VRAAG), waarom: NIETS_BEPAALD, tegen: NIETS_BEPAALD });
        return true;
      case "werkafspraken":
        inhoud.werkafspraken.push(tekst);
        return true;
      case "goedkeuring":
        inhoud.goedkeurders.push({ naam: tekst, rol: NIETS_BEPAALD, op: "" });
        return true;
      case "bijlagen":
        inhoud.bijlagen.push(zonderEtiket(tekst, ETIKET_BIJLAGE));
        return true;
      default:
        return false;
    }
  };

  /** Zet de huidige rubriek of het huidige thema, en meldt of dat gelukt is. */
  const zetSectie = (kopTekst: string): boolean => {
    const nieuw = sectieVanKop(kopTekst);
    if (!nieuw) return false;
    sectie = nieuw;
    if (nieuw.soort === "thema") laatsteThema = nieuw.letter;
    return true;
  };

  for (let index = 0; index < ingelezen.blokken.length; index++) {
    if (opgenomen.has(index)) continue;
    const blok = ingelezen.blokken[index];
    if (blok.soort === "tabel") {
      verwerkTabel(blok, inhoud, plaatsRegel, zetSectie);
      continue;
    }

    const kop = isKop(blok.tekst, blok.vet, blok.opsomming, blok.kopniveau);
    if (kop && zetSectie(blok.tekst)) continue;
    // Een kop die niets van het model raakt, blijft als tekst staan: beter een
    // regel te veel in de bespreking dan een verdwenen onderwerp.

    if (!plaatsRegel(blok.tekst, blok.opsomming)) {
      inhoud.nietGeplaatst.push(blok.tekst);
    }
  }

  // Doorlopende nummering. Altijd opnieuw, zodat het register klopt met de orde
  // van het verslag en niet met de orde van de beknopte notulen.
  inhoud.besluiten = inhoud.besluiten.map((b, i) => ({ ...b, nr: `B-${String(i + 1).padStart(2, "0")}` }));
  inhoud.acties = inhoud.acties.map((a, i) => ({ ...a, nr: `A-${String(i + 1).padStart(2, "0")}` }));

  // ------------------------------------------------------------------
  // Meldingen voor de beheerder.
  // ------------------------------------------------------------------
  const gevonden = KERNVELDEN.filter((v) => (inhoud.kerngegevens[v] ?? "") !== "");
  const ontbreken = KERNVELDEN.filter((v) => (inhoud.kerngegevens[v] ?? "") === "");

  if (regelsVoorEersteKop > 0) {
    aandacht.push(
      `${regelsVoorEersteKop} regel(s) stonden vóór de eerste herkenbare kop en staan nu in rubriek 2, Doel en leeswijzer.`,
    );
  }
  if (inhoud.besluiten.length === 0) {
    aandacht.push(
      "De omzetting herkende geen enkel besluit. Zet in de beknopte notulen \"Besluit:\" vooraan de regel, of gebruik een kop \"Besluiten\".",
    );
  }
  if (inhoud.acties.length === 0) {
    aandacht.push(
      "Geen enkele actie herkend. Zet \"Actie:\" vooraan de regel, of gebruik een kop \"Acties\" met één regel per actie.",
    );
  }
  const zonderEigenaar = inhoud.acties.filter((a) => a.eigenaar === NIETS_BEPAALD).length;
  if (zonderEigenaar > 0) {
    aandacht.push(`${zonderEigenaar} actie(s) hebben nog geen eigenaar. Vul de eigenaar aan in het verslag.`);
  }
  const zonderDatum = inhoud.acties.filter((a) => a.deadline === NIETS_BEPAALD).length;
  if (zonderDatum > 0) {
    aandacht.push(`${zonderDatum} actie(s) hebben nog geen datum. Het model vraagt één eigenaar en één datum per actie.`);
  }
  if (ontbreken.length > 0) {
    aandacht.push(
      `Deze kerngegevens ontbreken: ${ontbreken.join(", ")}. In het verslag staan ze als "nog te bepalen".`,
    );
  }
  if (inhoud.nietGeplaatst.length > 0) {
    aandacht.push(
      `${inhoud.nietGeplaatst.length} regel(s) kon de omzetting niet plaatsen. Ze staan achteraan het verslag onder "Nog te plaatsen".`,
    );
  }
  if (ingelezen.streepjesVervangen > 0) {
    aandacht.push(
      `${ingelezen.streepjesVervangen} gedachtestreepje(s) uit de beknopte notulen heeft de omzetting vervangen. De huisregel laat er geen enkel toe.`,
    );
  }

  const rapport: Omzetrapport = {
    bestandsnaam,
    alineas: ingelezen.alineas,
    tabellen: ingelezen.tabellen,
    streepjesVervangen: ingelezen.streepjesVervangen,
    kerngegevensGevonden: gevonden,
    kerngegevensOntbreken: ontbreken,
    themasMetInhoud: THEMA_LETTERS.filter((l) => {
      const t = inhoud.themas[l];
      return t.stand.length + t.bespreking.length + t.besluiten.length > 0;
    }),
    aantallen: {
      besluiten: inhoud.besluiten.length,
      acties: inhoud.acties.length,
      openPunten: inhoud.openPunten.length,
      risicos: inhoud.risicos.length,
      vragen: inhoud.vragen.length,
      werkafspraken: inhoud.werkafspraken.length,
      kernboodschap: inhoud.kernboodschap.length,
      opvolging: inhoud.opvolging.length,
      bijlagen: inhoud.bijlagen.length,
      nietGeplaatst: inhoud.nietGeplaatst.length,
    },
    aandacht,
  };

  return { inhoud, rapport };
}

// ---------------------------------------------------------------------------
// De voorpas over de kopregels bovenaan.
// ---------------------------------------------------------------------------

/**
 * Leest de losse regels bovenaan een beknopt verslag: de naam van het overleg,
 * de datum met het uur, en de plaats. Levert de indexen van de blokken die ze
 * heeft opgenomen, zodat de hoofdlus ze niet nog een tweede keer plaatst.
 *
 * De voorpas kijkt alleen naar de eerste acht alinea's en stopt bij de eerste
 * tabel. Verder in het document zijn zulke losse regels gewone tekst.
 */
function voorpasKerngegevens(ingelezen: Ingelezen, inhoud: VerslagInhoud): Set<number> {
  const opgenomen = new Set<number>();
  const grens = Math.min(ingelezen.blokken.length, 8);

  for (let i = 0; i < grens; i++) {
    const blok = ingelezen.blokken[i];
    if (blok.soort === "tabel") break;
    const tekst = blok.tekst.trim();
    if (tekst === "") continue;
    const woorden = tekst.split(/\s+/).length;
    const n = normaliseer(tekst);

    // De titel van het overleg.
    if (
      inhoud.kerngegevens.vergadering === undefined &&
      woorden <= 10 &&
      /^(team of captains|toc|verslag|notulen|vergadering|overleg)/.test(n) &&
      !n.includes(":")
    ) {
      inhoud.kerngegevens.vergadering = tekst;
      opgenomen.add(i);
      continue;
    }

    // Datum met eventueel een uurvork.
    if (
      inhoud.kerngegevens.datumEnUur === undefined &&
      woorden <= 12 &&
      /\d{1,2}\s*[\.\/\-]\s*\d{1,2}|\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)/i.test(
        tekst,
      )
    ) {
      inhoud.kerngegevens.datumEnUur = tekst;
      opgenomen.add(i);
      continue;
    }

    // De plaats van samenkomst.
    if (
      inhoud.kerngegevens.locatie === undefined &&
      woorden <= 8 &&
      /\b(zaal|lokaal|kantoor|office|vergaderzaal|teams|online|videogesprek|campus)\b/i.test(tekst) &&
      !tekst.includes(":")
    ) {
      inhoud.kerngegevens.locatie = tekst;
      opgenomen.add(i);
      continue;
    }
  }

  return opgenomen;
}

// ---------------------------------------------------------------------------
// Tabellen.
// ---------------------------------------------------------------------------

/**
 * Zoekt de kolom waarvan de kop een van deze woorden bevat.
 *
 * Een kop is altijd kort. Die grens is nodig: de eerste rij van een tabel is
 * niet altijd een koprij, en een rij met de volle bespreking erin draagt vaak
 * het woord "besluit" of "actie" middenin een zin. Zonder deze grens leest de
 * omzetting die tabel als een besluitenregister en gaat de hele bespreking
 * verloren in een register van één regel.
 */
function kolom(koppen: string[], woorden: string[]): number {
  for (let i = 0; i < koppen.length; i++) {
    const kop = koppen[i];
    if (kop.length > 30 || kop.split(/\s+/).length > 4) continue;
    if (bevatWoord(kop, woorden)) return i;
  }
  return -1;
}

function cel(rij: string[], index: number): string {
  if (index < 0 || index >= rij.length) return "";
  return rij[index].replace(/\n+/g, " ").trim();
}

function ofNietBepaald(waarde: string): string {
  return waarde === "" ? NIETS_BEPAALD : waarde;
}

/** True wanneer de regel zelf al zegt waar ze hoort, los van de kop erboven. */
function heeftEtiket(regel: string): boolean {
  return (
    ETIKET_BESLUIT.test(regel) ||
    ETIKET_ACTIE.test(regel) ||
    ETIKET_RISICO.test(regel) ||
    ETIKET_OPEN.test(regel) ||
    ETIKET_AFSPRAAK.test(regel) ||
    ETIKET_BIJLAGE.test(regel) ||
    kernuitRegel(regel) !== null
  );
}

/**
 * Herkent de onderwerpentabel: per rij een kort onderwerp en daarachter een cel
 * met de hele bespreking. Levert de kolomnummers, of null wanneer de tabel er
 * niet zo uitziet.
 *
 * De maat is eenvoudig en houdt stand: de laatste kolom draagt lange tekst, de
 * kolom ervoor korte tekst. Een kolom met alleen cijfers erin is een rijnummer
 * en geen onderwerp; in dat geval is er geen onderwerpkolom en blijven de regels
 * in de rubriek staan waar de tabel zelf onder valt.
 */
function onderwerpKolommen(rijen: string[][]): { label: number; inhoud: number } | null {
  const breedte = Math.max(...rijen.map((r) => r.length));
  if (breedte < 2 || breedte > 4) return null;
  if (rijen.length < 2) return null;

  const iInhoud = breedte - 1;
  const gemiddelde = (index: number): number => {
    const lengtes = rijen.map((r) => (index < r.length ? r[index].trim().length : 0));
    return lengtes.reduce((a, b) => a + b, 0) / rijen.length;
  };
  if (gemiddelde(iInhoud) < 60) return null;

  const iLabel = breedte - 2;
  if (gemiddelde(iLabel) === 0 || gemiddelde(iLabel) > 30) return null;
  const alleenCijfers = rijen.every((r) => {
    const waarde = iLabel < r.length ? r[iLabel].trim() : "";
    return waarde === "" || /^[\d.,]+$/.test(waarde);
  });

  return { label: alleenCijfers ? -1 : iLabel, inhoud: iInhoud };
}

function verwerkTabel(
  tabel: Tabel,
  inhoud: VerslagInhoud,
  plaatsRegel: (tekst: string, opsomming: boolean) => boolean,
  zetSectie: (kopTekst: string) => boolean,
): void {
  const rijen = tabel.rijen.filter((r) => r.some((c) => c.trim() !== ""));
  if (rijen.length === 0) return;

  const koppen = rijen[0].map((c) => normaliseer(c));
  const lijf = rijen.slice(1);

  // Alleen de korte cellen van de eerste rij gelden als koppen. Een eerste rij
  // is niet altijd een koprij: in een onderwerpentabel staat daar al inhoud, en
  // die inhoud draagt vaak het woord "besluit" of "actie" middenin een zin. Zonder
  // deze zeef leest de omzetting zo'n tabel als een besluitenregister.
  const kopregel = koppen
    .filter((k) => k.length <= 30 && k.split(/\s+/).length <= 4)
    .join(" ");

  const heeftActie = bevatWoord(kopregel, ["actie", "wat gebeurt", "to do", "todo"]);
  const heeftStand = bevatWoord(kopregel, ["stand", "status"]);
  const heeftBesluit = bevatWoord(kopregel, ["besluit", "beslissing"]);
  const heeftRisico = bevatWoord(kopregel, ["risico", "bedreiging"]);
  const heeftVraag = bevatWoord(kopregel, ["vraag", "gevraagd"]);
  const heeftPunt = bevatWoord(kopregel, ["punt", "ontbreekt", "beslissen"]);
  const heeftNaamRol = bevatWoord(kopregel, ["naam"]) && bevatWoord(kopregel, ["rol", "functie"]);

  // Opvolging van vorige acties: een actietabel met een standkolom.
  if (heeftActie && heeftStand && lijf.length > 0) {
    const iNr = kolom(koppen, ["nr", "nummer"]);
    const iActie = kolom(koppen, ["actie", "wat gebeurt"]);
    const iEig = kolom(koppen, ["eigenaar", "verantwoordelijke", "wie", "owner"]);
    const iDatum = kolom(koppen, ["datum", "deadline", "afgesproken"]);
    const iStand = kolom(koppen, ["stand", "status"]);
    for (const r of lijf) {
      const actie = cel(r, iActie >= 0 ? iActie : 1);
      if (actie === "") continue;
      inhoud.opvolging.push({
        nr: cel(r, iNr) || String(inhoud.opvolging.length + 1).padStart(2, "0"),
        actie,
        eigenaar: ofNietBepaald(cel(r, iEig)),
        datum: ofNietBepaald(leesDatum(cel(r, iDatum))),
        stand: ofNietBepaald(cel(r, iStand)),
      });
    }
    return;
  }

  if (heeftActie && lijf.length > 0) {
    const iActie = kolom(koppen, ["actie", "wat gebeurt", "to do", "todo"]);
    const iEig = kolom(koppen, ["eigenaar", "verantwoordelijke", "wie", "owner"]);
    const iDatum = kolom(koppen, ["deadline", "datum", "tegen"]);
    const iPrio = kolom(koppen, ["prioriteit", "urgentie"]);
    for (const r of lijf) {
      const tekst = cel(r, iActie >= 0 ? iActie : 0);
      if (tekst === "") continue;
      const eigenaar = cel(r, iEig);
      const datum = cel(r, iDatum);
      const prio = cel(r, iPrio).toLowerCase();
      const basis = leesKenmerken(tekst);
      const actie: Actie = {
        nr: "",
        tekst: basis.tekst,
        eigenaar: eigenaar !== "" ? eigenaar : basis.eigenaar,
        deadline: datum !== "" ? (/(nog te bepalen|ntb)/i.test(datum) ? NIETS_BEPAALD : leesDatum(datum)) : basis.deadline,
        prioriteit: prio.includes("hoog") ? "hoog" : prio.includes("laag") ? "laag" : basis.prioriteit,
      };
      inhoud.acties.push(actie);
    }
    return;
  }

  if (heeftBesluit && lijf.length > 0) {
    const iBesluit = kolom(koppen, ["besluit", "beslissing"]);
    const iThema = kolom(koppen, ["thema", "onderwerp"]);
    const iEig = kolom(koppen, ["eigenaar", "verantwoordelijke", "wie"]);
    for (const r of lijf) {
      const tekst = cel(r, iBesluit >= 0 ? iBesluit : 0);
      if (tekst === "") continue;
      const besluit: Besluit = {
        nr: "",
        tekst,
        thema: ofNietBepaald(cel(r, iThema)),
        eigenaar: ofNietBepaald(cel(r, iEig)),
      };
      inhoud.besluiten.push(besluit);
    }
    return;
  }

  if (heeftRisico && lijf.length > 0) {
    const iRisico = kolom(koppen, ["risico", "bedreiging"]);
    const iGevolg = kolom(koppen, ["gevolg", "impact", "raakt"]);
    const iMaatregel = kolom(koppen, ["maatregel", "beheersing", "wat wij doen", "aanpak"]);
    const iEig = kolom(koppen, ["eigenaar", "verantwoordelijke", "wie"]);
    for (const r of lijf) {
      const risico = cel(r, iRisico >= 0 ? iRisico : 0);
      if (risico === "") continue;
      inhoud.risicos.push({
        risico,
        gevolg: ofNietBepaald(cel(r, iGevolg)),
        maatregel: ofNietBepaald(cel(r, iMaatregel)),
        eigenaar: ofNietBepaald(cel(r, iEig)),
      });
    }
    return;
  }

  if (heeftVraag && lijf.length > 0) {
    const iVraag = kolom(koppen, ["vraag"]);
    const iWaarom = kolom(koppen, ["waarom", "waarvoor", "ontgrendelt", "reden"]);
    const iTegen = kolom(koppen, ["gevraagd", "tegen", "datum", "wanneer"]);
    for (const r of lijf) {
      const vraag = cel(r, iVraag >= 0 ? iVraag : 0);
      if (vraag === "") continue;
      inhoud.vragen.push({
        vraag,
        waarom: ofNietBepaald(cel(r, iWaarom)),
        tegen: ofNietBepaald(cel(r, iTegen)),
      });
    }
    return;
  }

  if (heeftPunt && lijf.length > 0) {
    const iPunt = kolom(koppen, ["punt", "onderwerp"]);
    const iOntbreekt = kolom(koppen, ["ontbreekt", "nodig", "beslissen"]);
    const iTerug = kolom(koppen, ["terug", "agenda", "wanneer"]);
    for (const r of lijf) {
      const punt = cel(r, iPunt >= 0 ? iPunt : 0);
      if (punt === "") continue;
      inhoud.openPunten.push({
        punt,
        ontbreekt: ofNietBepaald(cel(r, iOntbreekt)),
        terug: ofNietBepaald(cel(r, iTerug)),
      });
    }
    return;
  }

  if (heeftNaamRol && lijf.length > 0) {
    const iNaam = kolom(koppen, ["naam"]);
    const iRol = kolom(koppen, ["rol", "functie"]);
    const iOp = kolom(koppen, ["goedgekeurd", "datum", "op"]);
    for (const r of lijf) {
      const naam = cel(r, iNaam >= 0 ? iNaam : 0);
      if (naam === "") continue;
      inhoud.goedkeurders.push({ naam, rol: ofNietBepaald(cel(r, iRol)), op: cel(r, iOp) });
    }
    return;
  }

  // Tweekolomstabel met kerngegevens: "Aanwezig | Marc, Herman, Andrea".
  if (rijen.every((r) => r.length === 2)) {
    let geraakt = 0;
    for (const r of rijen) {
      const veld = kernveldVanSleutel(normaliseer(r[0]));
      const waarde = r[1].replace(/\n+/g, ", ").trim();
      if (veld && waarde !== "") {
        if (inhoud.kerngegevens[veld] === undefined) inhoud.kerngegevens[veld] = waarde;
        geraakt += 1;
      }
    }
    if (geraakt > 0) {
      // De rijen die geen kernveld waren, lopen nog langs de gewone weg.
      for (const r of rijen) {
        const veld = kernveldVanSleutel(normaliseer(r[0]));
        if (veld) continue;
        const regel = r.filter((c) => c.trim() !== "").join(": ");
        if (regel !== "" && !plaatsRegel(regel, false)) inhoud.nietGeplaatst.push(regel);
      }
      return;
    }
  }

  // De onderwerpentabel. Dit is de vorm waarin beknopte notulen in de praktijk
  // het vaakst geschreven worden: per rij een nummer, een onderwerp in één of
  // twee woorden, en daarachter een cel met alles wat over dat onderwerp gezegd
  // is. Het onderwerp werkt dan als kop, en de inhoudscel als de regels eronder.
  const onderwerp = onderwerpKolommen(rijen);
  if (onderwerp) {
    for (const r of rijen) {
      const kop = cel(r, onderwerp.label);
      const gekend = kop === "" ? true : zetSectie(kop);
      const inhoudsCel = onderwerp.inhoud < r.length ? r[onderwerp.inhoud] : "";
      const regels = inhoudsCel
        .split(/\n|(?<=[.!?])\s+(?=[A-Z\u00c0-\u00dd])/)
        .map((s) => s.trim())
        .filter((s) => s !== "");

      for (const regel of regels) {
        // Een onderwerp dat het model niet kent, mag zijn regels niet in een
        // vreemde rubriek duwen. Een besluit of een actie blijft wel een besluit
        // of een actie, want dat staat in de regel zelf. De rest gaat met het
        // onderwerp ervoor naar de rubriek met het restwerk, waar de beheerder
        // ze in één beweging een plaats geeft.
        if (!gekend && !heeftEtiket(regel)) {
          inhoud.nietGeplaatst.push(`${kop}: ${regel}`);
          continue;
        }
        if (!plaatsRegel(regel, true)) inhoud.nietGeplaatst.push(regel);
      }

      // Een onderwerp zonder inhoud mag niet verdwijnen: het blijft als regel.
      if (regels.length === 0 && kop !== "" && !gekend) inhoud.nietGeplaatst.push(kop);
    }
    return;
  }

  // Onbekende tabel: elke rij wordt een regel langs de gewone weg, zodat de
  // inhoud bewaard blijft ook wanneer de vorm niet herkend wordt.
  for (const r of rijen) {
    const regel = r
      .map((c) => c.replace(/\n+/g, " ").trim())
      .filter((c) => c !== "")
      .join(": ");
    if (regel === "") continue;
    if (!plaatsRegel(regel, false)) inhoud.nietGeplaatst.push(regel);
  }
}
