// 2MINSCAN — Energetisch Gedragsprofiel (EG)
// Kern-datalaag: woorden, kleuren, intro/extravert-stellingen, 24-profielen-mapping.
// Bron: Johan Duré (woordenlijst jan 2018), typologie-mappingtabel jan 2022, EG-profielenbibliotheek.
// BELANGRIJK: interne vaktermen (Taibi Kahler / Jung) blijven onzichtbaar voor de deelnemer.

export type KleurId = "blauw" | "groen" | "geel" | "rood";

export interface KleurDef {
  id: KleurId;
  label: string;        // intern label (niet tonen als kleurnaam aan deelnemer in afname)
  hex: string;          // accentkleur voor het kaartje
  woorden: string[];    // 8 woorden
}

// De 4 kleuren met elk 8 woorden (32 totaal).
export const KLEUREN: KleurDef[] = [
  {
    id: "blauw",
    label: "Blauw",
    hex: "#2F6F8F",
    woorden: [
      "analytisch", "nauwkeurig", "gedetailleerd", "objectief",
      "risicobeperkend", "planmatig", "gestructureerd", "stipt",
    ],
  },
  {
    id: "groen",
    label: "Groen",
    hex: "#2E7D5B",
    woorden: [
      "gericht op de ander", "zorgzaam", "conflictvermijdend", "luisterend",
      "geduldig", "hulpvaardig", "rustgevend", "ondersteunend",
    ],
  },
  {
    id: "geel",
    label: "Geel",
    hex: "#C8932B",
    woorden: [
      "samen met anderen", "dynamisch", "enthousiast", "overtuigend",
      "expressief", "positief", "story teller", "avontuurlijk",
    ],
  },
  {
    id: "rood",
    label: "Rood",
    hex: "#B14B3A",
    woorden: [
      "prestatiegericht", "daadkrachtig", "veeleisend", "vastberaden",
      "doelbewust", "oplossingsgericht", "snel handelend", "resultaatsgedreven",
    ],
  },
];

// Vlakke lijst van alle 32 woorden met kleur-id, voor het kaartjesraster.
export interface WoordKaart {
  woord: string;
  kleur: KleurId;
}
export const ALLE_WOORDEN: WoordKaart[] = KLEUREN.flatMap((k) =>
  k.woorden.map((w) => ({ woord: w, kleur: k.id }))
);

// ----------------------------------------------------------------------------
// Intro / extravert-vragenlijst — 21 stellingen.
// "Kruis élke uitspraak aan waarin je jezelf herkent."
// Stellingen 3, 5, 9, 12, 16 = ruis (tellen niet mee).
// ----------------------------------------------------------------------------

export type IEType = "E" | "I" | "ruis";

export interface IEStelling {
  nr: number;
  tekst: string;
  type: IEType;
}

export const IE_STELLINGEN: IEStelling[] = [
  { nr: 1,  tekst: "Ik krijg energie van het samenzijn en de interactie met andere mensen.", type: "E" },
  { nr: 2,  tekst: "Ik laad het best op wanneer ik even tijd voor mezelf heb.", type: "I" },
  { nr: 3,  tekst: "Ik hou ervan om nieuwe dingen te leren.", type: "ruis" },
  { nr: 4,  tekst: "Ik denk vaak hardop en vorm mijn gedachten al pratend.", type: "E" },
  { nr: 5,  tekst: "Ik vind het belangrijk dat afspraken worden nagekomen.", type: "ruis" },
  { nr: 6,  tekst: "Ik verwerk informatie liever eerst intern voor ik erover spreek.", type: "I" },
  { nr: 7,  tekst: "In een groep neem ik vlot het initiatief in een gesprek.", type: "E" },
  { nr: 8,  tekst: "Ik ben vaak liever alleen of met een enkeling dan in een grote groep.", type: "I" },
  { nr: 9,  tekst: "Ik hecht belang aan eerlijkheid en transparantie.", type: "ruis" },
  { nr: 10, tekst: "Ik heb na een drukke dag met veel contacten tijd nodig om te herstellen.", type: "I" },
  { nr: 11, tekst: "Ik denk graag eerst goed na voor ik iets zeg.", type: "I" },
  { nr: 12, tekst: "Ik vind het fijn om mensen te helpen.", type: "ruis" },
  { nr: 13, tekst: "Ik zoek spontaan contact met mensen die ik nog niet ken.", type: "E" },
  { nr: 14, tekst: "Ik geniet van rustige momenten van reflectie en bezinning.", type: "I" },
  { nr: 15, tekst: "Ik voel me opgeladen na een dag vol gesprekken en ontmoetingen.", type: "E" },
  { nr: 16, tekst: "Ik probeer steeds bij te leren en mezelf te ontwikkelen.", type: "ruis" },
  { nr: 17, tekst: "Ik richt mijn aandacht vaak naar binnen, op mijn eigen gedachten en gevoelens.", type: "I" },
  { nr: 18, tekst: "Ik heb een beperkte kring van diepere, persoonlijke contacten.", type: "I" },
  { nr: 19, tekst: "Ik praat makkelijk en veel, ook met mensen die ik nauwelijks ken.", type: "E" },
  { nr: 20, tekst: "Ik zoek de buitenwereld op om mij energiek en levendig te voelen.", type: "E" },
  { nr: 21, tekst: "Ik ben graag actief bezig, onder de mensen en in beweging.", type: "E" },
];

// IE-uitkomst op basis van (som introversie - som extraversie).
export type IEUitkomst =
  | "meer_introvert"
  | "iets_introvert"
  | "ambivert"
  | "iets_extravert"
  | "meer_extravert";

export interface IEResultaat {
  introScore: number;
  extraScore: number;
  verschil: number;     // intro - extra
  uitkomst: IEUitkomst;
  // "X"-stand voor de mapping: II (introvert), EE (extravert), IE/EI (ambivert)
  xStand: "II" | "EE" | "X";
  label: string;        // mensvriendelijke tekst
}

export function berekenIE(aangevinkt: Set<number>): IEResultaat {
  let intro = 0;
  let extra = 0;
  for (const s of IE_STELLINGEN) {
    if (s.type === "ruis") continue;
    if (aangevinkt.has(s.nr)) {
      if (s.type === "I") intro++;
      else if (s.type === "E") extra++;
    }
  }
  const verschil = intro - extra;
  let uitkomst: IEUitkomst;
  let xStand: "II" | "EE" | "X";
  let label: string;
  // EE = uitgesproken extravert, II = uitgesproken introvert (de minderheid die
  // écht geheel aan één kant zit). Daartussen = ambivert; bij een licht verschil
  // spreekt de bron van een lichte voorkeur ("net iets meer introvert/extravert").
  if (verschil >= 3) {
    uitkomst = "meer_introvert"; xStand = "II"; label = "uitgesproken introvert";
  } else if (verschil === 2) {
    uitkomst = "iets_introvert"; xStand = "X"; label = "ambivert met lichte voorkeur voor introversie";
  } else if (verschil <= -3) {
    uitkomst = "meer_extravert"; xStand = "EE"; label = "uitgesproken extravert";
  } else if (verschil === -2) {
    uitkomst = "iets_extravert"; xStand = "X"; label = "ambivert met lichte voorkeur voor extraversie";
  } else {
    uitkomst = "ambivert"; xStand = "X"; label = "ambivert";
  }
  return { introScore: intro, extraScore: extra, verschil, uitkomst, xStand, label };
}

// ----------------------------------------------------------------------------
// Kleurscores op basis van de 2 selectierondes.
// Ronde 1: 8 woorden -> elk +2 punten voor zijn kleur.
// Ronde 2: 8 woorden -> elk +1 punt voor zijn kleur.
// ----------------------------------------------------------------------------

export interface KleurScore {
  blauw: number;
  groen: number;
  geel: number;
  rood: number;
}

export function berekenKleurScores(
  ronde1: string[],
  ronde2: string[]
): KleurScore {
  const score: KleurScore = { blauw: 0, groen: 0, geel: 0, rood: 0 };
  const kleurVan = (w: string): KleurId | undefined =>
    ALLE_WOORDEN.find((c) => c.woord === w)?.kleur;
  for (const w of ronde1) {
    const k = kleurVan(w);
    if (k) score[k] += 2;
  }
  for (const w of ronde2) {
    const k = kleurVan(w);
    if (k) score[k] += 1;
  }
  return score;
}

// Geordende kleurvolgorde (hoogste -> laagste). Bij gelijke score: vaste tie-break
// volgorde rood, geel, groen, blauw (stabiel en reproduceerbaar).
const TIE_BREAK: KleurId[] = ["rood", "geel", "groen", "blauw"];
export function kleurVolgorde(score: KleurScore): KleurId[] {
  const ids: KleurId[] = ["blauw", "groen", "geel", "rood"];
  return [...ids].sort((a, b) => {
    if (score[b] !== score[a]) return score[b] - score[a];
    return TIE_BREAK.indexOf(a) - TIE_BREAK.indexOf(b);
  });
}

// Korte kleurcodes voor de mappingtabel.
export const KLEURCODE: Record<KleurId, string> = {
  blauw: "BL", groen: "GR", geel: "GE", rood: "RO",
};
