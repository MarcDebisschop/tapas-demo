// ---------------------------------------------------------------------------
// server/notulen-toc/redactie.ts  -  NIEUW BESTAND
//
// De redactieronde bovenop de omzetting.
//
// WAAROM DIT BESTAAT. Beknopte notulen worden getypt tijdens een vergadering, in
// telegramstijl, met de woorden die in de zaal vielen. Daar zitten Engelse
// leenvertalingen in ("in lijn met de roadmap"), ambtelijke wendingen
// ("teneinde", "dienaangaande") en naamwoordstijl waar een werkwoord hoort. Een
// verslag dat naar aandeelhouders en investeringspartners gaat, mag die sporen
// niet dragen. De omzetting maakte tot nu de opmaak in orde en liet de taal
// staan zoals ze was.
//
// WAT DEZE RONDE WEL DOET. Zij vervangt wat mechanisch veilig te vervangen is:
// vaste woorden en wendingen, één op één, zonder de zin te herbouwen. Elke
// vervanging komt in een tabel terecht met wat er stond, wat er nu staat en
// waarom. Die tabel is het bewijsstuk, niet de belofte.
//
// WAT ZIJ NIET DOET, en waarom dat hier staat in plaats van in de kleine
// lettertjes: zij keurt vorm en geen betekenis. Een zin die te lang is, een
// lijdende vorm met een verstopte dader, een verwijswoord dat naar het verkeerde
// wijst: die worden gemeld en niet aangeraakt, want een machine die daar zelf in
// snijdt, verandert de inhoud van een verslag. Het rapport zegt daarom altijd
// dat een mens de tekst nog moet lezen. De redactiepoort van het huis vraagt een
// leesronde door iemand anders dan de schrijver, en die kan geen server nabootsen.
//
// De streepjesregel staat niet hier maar in schoonTekst (model.ts): elke tekst
// uit een geüpload bestand gaat daar al door.
// ---------------------------------------------------------------------------

import type { VerslagInhoud } from "./model";

export type Categorie =
  | "leenvertaling"
  | "naamwoordstijl"
  | "schrijftaal"
  | "belgisch"
  | "tangconstructie"
  | "lijdende vorm"
  | "verwijswoord"
  | "lange zin";

export interface Wijziging {
  /** Waar in het verslag de tekst stond, in gewone woorden. */
  plaats: string;
  categorie: Categorie;
  voor: string;
  na: string;
}

export interface Aandachtspunt {
  plaats: string;
  categorie: Categorie;
  melding: string;
  fragment: string;
}

export interface Redactierapport {
  aantalWijzigingen: number;
  wijzigingen: Wijziging[];
  aandacht: Aandachtspunt[];
  /** Gemiddelde zinslengte na de ronde. Streefwaarde van het huis: achttien. */
  gemiddeldeZinslengte: number;
  /** Aandeel zinnen in de lijdende vorm, afgerond op procenten. Hoogstens twintig. */
  lijdendeVormProcent: number;
  /** Staat altijd op waar: een machine vervangt geen leesronde. */
  leesrondeNodig: boolean;
  slotwoord: string;
}

// ---------------------------------------------------------------------------
// De woordenlijst.
//
// Alleen wat één op één te vervangen is zonder de zin te herbouwen. Elke regel
// draagt zijn categorie, zodat de tabel achteraf niet geraden hoeft te worden.
// De sleutel is een patroon met woordgrenzen; de vervanging krijgt de hoofdletter
// van het origineel terug (zie metHoofdletter).
// ---------------------------------------------------------------------------

interface Woordregel {
  patroon: RegExp;
  vervang: string;
  categorie: Categorie;
}

function regel(zoek: string, vervang: string, categorie: Categorie): Woordregel {
  return { patroon: new RegExp(`\\b${zoek}\\b`, "gi"), vervang, categorie };
}

export const WOORDREGELS: Woordregel[] = [
  // Leenvertalingen en Engelse woorden waarvoor een gewoon Nederlands woord bestaat.
  regel("in lijn met", "volgens", "leenvertaling"),
  regel("gedreven door", "door", "leenvertaling"),
  regel("impacteert", "beïnvloedt", "leenvertaling"),
  regel("impacteren", "beïnvloeden", "leenvertaling"),
  regel("implementatie", "invoering", "leenvertaling"),
  regel("implementeren", "invoeren", "leenvertaling"),
  // Vervoegde vormen krijgen een eigen regel, en alleen wanneer het Nederlandse
  // woord niet scheidbaar is. "implementeert" wordt niet vervangen door "voert
  // in", want dan belandt het deel achteraan op de verkeerde plaats in de zin.
  regel("finaliseren", "voltooien", "leenvertaling"),
  regel("finaliseert", "voltooit", "leenvertaling"),
  regel("gefinaliseerd", "voltooid", "leenvertaling"),
  regel("ge\u00efmplementeerd", "ingevoerd", "leenvertaling"),
  regel("meeting", "overleg", "leenvertaling"),
  regel("meetings", "overleggen", "leenvertaling"),
  regel("targets", "doelen", "leenvertaling"),
  regel("target", "doel", "leenvertaling"),
  regel("issues", "knelpunten", "leenvertaling"),
  regel("issue", "knelpunt", "leenvertaling"),
  regel("asap", "zo snel mogelijk", "leenvertaling"),
  regel("commitment", "toezegging", "leenvertaling"),
  regel("alignment", "afstemming", "leenvertaling"),
  regel("aligneren", "afstemmen", "leenvertaling"),
  regel("challenges", "uitdagingen", "leenvertaling"),
  regel("challenge", "uitdaging", "leenvertaling"),
  regel("ownership", "verantwoordelijkheid", "leenvertaling"),
  regel("roadmap", "planning", "leenvertaling"),
  regel("scope", "omvang", "leenvertaling"),
  regel("follow-up", "opvolging", "leenvertaling"),
  regel("updaten", "bijwerken", "leenvertaling"),
  regel("next steps", "volgende stappen", "leenvertaling"),
  regel("quick wins", "snelle winsten", "leenvertaling"),
  regel("quick win", "snelle winst", "leenvertaling"),
  regel("op dit moment in tijd", "nu", "leenvertaling"),
  regel("in the loop houden", "op de hoogte houden", "leenvertaling"),

  // Schrijftaal die niemand zegt, en die een verslag stijf maakt.
  regel("teneinde", "om", "schrijftaal"),
  regel("desgevallend", "eventueel", "schrijftaal"),
  regel("dienaangaande", "hierover", "schrijftaal"),
  regel("alsook", "en", "schrijftaal"),
  regel("inzake", "over", "schrijftaal"),
  regel("middels", "met", "schrijftaal"),
  regel("conform", "volgens", "schrijftaal"),
  regel("zulks", "dat", "schrijftaal"),
  regel("voornoemde", "genoemde", "schrijftaal"),
  regel("aangaande", "over", "schrijftaal"),
  regel("met betrekking tot", "over", "schrijftaal"),
  regel("in het kader van", "voor", "schrijftaal"),
  regel("op heden", "vandaag", "schrijftaal"),
  regel("bij deze", "hiermee", "schrijftaal"),

  // Naamwoordstijl waar een werkwoord hoort, voor zover veilig te vervangen.
  regel("in uitvoering brengen", "uitvoeren", "naamwoordstijl"),
  regel("tot uitvoering brengen", "uitvoeren", "naamwoordstijl"),
  regel("een beslissing nemen over", "beslissen over", "naamwoordstijl"),
  regel("de bespreking voeren over", "bespreken", "naamwoordstijl"),
  regel("uitvoering geven aan", "uitvoeren", "naamwoordstijl"),

  // Belgische vormen die geen standaardtaal zijn.
  regel("tegen dat", "voordat", "belgisch"),
  regel("op punt stellen", "afwerken", "belgisch"),
  regel("op punt zetten", "afwerken", "belgisch"),
  regel("in vraag stellen", "ter discussie stellen", "belgisch"),
  regel("goesting", "zin", "belgisch"),
  regel("ambetant", "lastig", "belgisch"),
  regel("seffens", "straks", "belgisch"),
];

/** Geeft de vervanging de hoofdletter van het origineel terug. */
function metHoofdletter(origineel: string, vervanging: string): string {
  const eerste = origineel.charAt(0);
  if (eerste && eerste === eerste.toUpperCase() && eerste !== eerste.toLowerCase()) {
    return vervanging.charAt(0).toUpperCase() + vervanging.slice(1);
  }
  return vervanging;
}

// ---------------------------------------------------------------------------
// De meldingen. Deze gevallen worden gezien en niet aangeraakt.
// ---------------------------------------------------------------------------

const MAX_ZIN = 30;
const MAX_TANG = 6;

const HULPWERKWOORDEN =
  "(?:is|zijn|was|waren|wordt|worden|werd|werden|heeft|hebben|had|hadden|zal|zullen|kan|kunnen|moet|moeten)";
const DEELWOORD = "(?:ge\\w+|\\w+eerd|\\w+erd)";

export function splitsZinnen(tekst: string): string[] {
  return tekst
    .split(/(?<=[.!?])\s+/)
    .map((z) => z.trim())
    .filter((z) => z.length > 0);
}

function aantalWoorden(zin: string): number {
  return zin.split(/\s+/).filter(Boolean).length;
}

/** Zoekt de gevallen die een mens moet beslissen. Verandert niets. */
export function meldingenVoor(tekst: string, plaats: string): Aandachtspunt[] {
  const uit: Aandachtspunt[] = [];
  for (const zin of splitsZinnen(tekst)) {
    const woorden = aantalWoorden(zin);
    if (woorden > MAX_ZIN) {
      uit.push({
        plaats,
        categorie: "lange zin",
        melding: `Deze zin telt ${woorden} woorden. Knip hem in twee.`,
        fragment: zin,
      });
    }

    const tang = new RegExp(`\\b${HULPWERKWOORDEN}\\b((?:\\s+\\S+){${MAX_TANG + 1},}?)\\s+\\b${DEELWOORD}\\b`, "i");
    const tangTreffer = zin.match(tang);
    if (tangTreffer) {
      const tussen = aantalWoorden(tangTreffer[1]);
      uit.push({
        plaats,
        categorie: "tangconstructie",
        melding: `Er staan ${tussen} woorden tussen het hulpwerkwoord en het deelwoord. Zet het deelwoord naar voren.`,
        fragment: zin,
      });
    }

    if (/\b(?:wordt|worden|werd|werden)\b[^.]*\bdoor\b/i.test(zin)) {
      uit.push({
        plaats,
        categorie: "lijdende vorm",
        melding: "Er staat een dader in de zin. Zet die dader vooraan en maak de zin bedrijvend.",
        fragment: zin,
      });
    }

    if (/^(?:Dit|Dat|Hetgeen|Deze)\b(?!\s+(?:verslag|vergadering|punt|actie|beslissing|tabel|bijlage))/i.test(zin)) {
      uit.push({
        plaats,
        categorie: "verwijswoord",
        melding:
          "Dit verwijswoord staat vooraan, en het is niet duidelijk waarnaar het wijst. Noem de zaak zelf.",
        fragment: zin,
      });
    }
  }
  return uit;
}

// ---------------------------------------------------------------------------
// De ronde zelf.
// ---------------------------------------------------------------------------

export interface TekstUitslag {
  tekst: string;
  wijzigingen: Wijziging[];
  aandacht: Aandachtspunt[];
}

/** Redigeert één tekst. Werpt niet en laat een lege tekst met rust. */
export function redigeerTekst(ruw: string, plaats: string): TekstUitslag {
  const wijzigingen: Wijziging[] = [];
  if (!ruw || !ruw.trim()) return { tekst: ruw, wijzigingen, aandacht: [] };

  let tekst = ruw;
  for (const r of WOORDREGELS) {
    tekst = tekst.replace(r.patroon, (treffer) => {
      const vervanging = metHoofdletter(treffer, r.vervang);
      wijzigingen.push({ plaats, categorie: r.categorie, voor: treffer, na: vervanging });
      return vervanging;
    });
  }
  // Een vervanging kan een dubbele ruimte of een losse komma achterlaten.
  tekst = tekst.replace(/[ \t]{2,}/g, " ").replace(/\s+([,.;:])/g, "$1").trim();

  return { tekst, wijzigingen, aandacht: meldingenVoor(tekst, plaats) };
}

/** Elke tekst van het verslag, met de plaats waar ze staat. */
function velden(inhoud: VerslagInhoud): Array<{ plaats: string; lees: () => string; schrijf: (t: string) => void }> {
  const uit: Array<{ plaats: string; lees: () => string; schrijf: (t: string) => void }> = [];

  const lijst = (plaats: string, rijen: string[]) => {
    rijen.forEach((_, i) =>
      uit.push({ plaats: `${plaats} ${i + 1}`, lees: () => rijen[i], schrijf: (t) => (rijen[i] = t) }),
    );
  };
  const veld = <T extends object, K extends keyof T>(plaats: string, rij: T, sleutel: K) => {
    uit.push({
      plaats,
      lees: () => String(rij[sleutel] ?? ""),
      schrijf: (t) => ((rij[sleutel] as unknown as string) = t),
    });
  };

  // De kerngegevens blijven buiten de ronde: dat zijn namen, datums en plaatsen.
  // Een woordenlijst heeft daar niets te zoeken en zou "Locatie: op heden" of
  // een naam met een vervangen woord kunnen opleveren.
  lijst("Doel van de vergadering", inhoud.doel);
  lijst("Kernboodschap", inhoud.kernboodschap);
  lijst("Vaststelling vorig verslag", inhoud.vaststellingVorigVerslag);
  lijst("Werkafspraken", inhoud.werkafspraken);
  lijst("Bijlagen", inhoud.bijlagen);
  lijst("Niet geplaatst", inhoud.nietGeplaatst);

  for (const [letter, thema] of Object.entries(inhoud.themas)) {
    lijst(`Thema ${letter}, stand van zaken`, thema.stand);
    lijst(`Thema ${letter}, bespreking`, thema.bespreking);
    lijst(`Thema ${letter}, besluiten`, thema.besluiten);
  }

  inhoud.opvolging.forEach((r, i) => veld(`Opvolging, rij ${i + 1}`, r, "actie"));
  inhoud.besluiten.forEach((r, i) => veld(`Besluit ${r.nr || i + 1}`, r, "tekst"));
  inhoud.acties.forEach((r, i) => veld(`Actie ${r.nr || i + 1}`, r, "tekst"));
  inhoud.openPunten.forEach((r, i) => {
    veld(`Open punt ${i + 1}`, r, "punt");
    veld(`Open punt ${i + 1}, wat ontbreekt`, r, "ontbreekt");
  });
  inhoud.risicos.forEach((r, i) => {
    veld(`Risico ${i + 1}`, r, "risico");
    veld(`Risico ${i + 1}, gevolg`, r, "gevolg");
    veld(`Risico ${i + 1}, maatregel`, r, "maatregel");
  });
  inhoud.vragen.forEach((r, i) => {
    veld(`Vraag aan de partner ${i + 1}`, r, "vraag");
    veld(`Vraag aan de partner ${i + 1}, waarom`, r, "waarom");
  });

  return uit;
}

/**
 * Redigeert een volledig verslag ter plaatse en levert de tabel op.
 *
 * Werkt op het doorgegeven verslag zelf, want de omzetting bouwt daarna het
 * Word-bestand uit dezelfde vorm. De kerngegevens blijven onaangeroerd.
 */
export function redigeerVerslag(inhoud: VerslagInhoud): Redactierapport {
  const wijzigingen: Wijziging[] = [];
  const aandacht: Aandachtspunt[] = [];
  const zinnen: string[] = [];

  for (const v of velden(inhoud)) {
    const uitslag = redigeerTekst(v.lees(), v.plaats);
    if (uitslag.tekst !== v.lees()) v.schrijf(uitslag.tekst);
    wijzigingen.push(...uitslag.wijzigingen);
    aandacht.push(...uitslag.aandacht);
    zinnen.push(...splitsZinnen(uitslag.tekst));
  }

  const woorden = zinnen.reduce((som, z) => som + aantalWoorden(z), 0);
  const lijdend = zinnen.filter((z) => /\b(?:wordt|worden|werd|werden)\b/i.test(z)).length;

  return {
    aantalWijzigingen: wijzigingen.length,
    wijzigingen,
    aandacht,
    gemiddeldeZinslengte: zinnen.length ? Math.round((woorden / zinnen.length) * 10) / 10 : 0,
    lijdendeVormProcent: zinnen.length ? Math.round((lijdend / zinnen.length) * 100) : 0,
    leesrondeNodig: true,
    slotwoord:
      "Deze ronde verving vaste woorden en wendingen. Zij keurde de vorm, niet de betekenis. " +
      "Lees het verslag daarna zelf na. Vraag dat nalezen bij voorkeur aan iemand die de notulen niet heeft getypt.",
  };
}
