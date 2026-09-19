// ---------------------------------------------------------------------------
// server/notulen-toc/inlezen.ts  -  NIEUW BESTAND
//
// Stap één van de omzetting: een geüpload Word-bestand wordt een platte reeks
// blokken. Alleen wat de herkenning nodig heeft, komt mee: de tekst van elke
// alinea, of ze vet staat, of ze in een opsomming staat, welke kopstijl ze
// draagt, en de cellen van elke tabel.
//
// Opmaak blijft hier bewust buiten. Het doel van de omzetting is niet het
// overnemen van de opmaak van de beknopte notulen, maar het overbrengen van hun
// inhoud naar de vaste huisstijl. Alles wat van opmaak meekomt, zou daar later
// weer uit moeten.
// ---------------------------------------------------------------------------
import JSZip from "jszip";
import { schoonTekst, telStreepjes } from "./model";
import { kind, kinderen, parseXml, zoekDiep, type XmlNode } from "./xml";

export interface Alinea {
  soort: "alinea";
  tekst: string;
  /** True wanneer elke lopende tekst in de alinea vet staat. */
  vet: boolean;
  /** True wanneer de alinea aan een opsommingsnummering hangt. */
  opsomming: boolean;
  /** Kopniveau uit de Word-stijl: 1 tot 9, of 0 wanneer het geen kop is. */
  kopniveau: number;
}

export interface Tabel {
  soort: "tabel";
  rijen: string[][];
}

export type Blok = Alinea | Tabel;

export interface Ingelezen {
  blokken: Blok[];
  alineas: number;
  tabellen: number;
  streepjesVervangen: number;
}

const DOCUMENT_PAD = "word/document.xml";

/** Fout met een boodschap die rechtstreeks aan de beheerder getoond mag worden. */
export class InleesFout extends Error {}

/**
 * Leest een docx-buffer en levert de blokken in documentorde.
 * Werpt InleesFout wanneer het bestand geen Word-bestand is.
 */
export async function leesDocx(buffer: Buffer): Promise<Ingelezen> {
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new InleesFout(
      "Dit is geen Word-bestand (.docx). Een .doc van vroeger of een pdf werkt niet; bewaar het bestand eerst als .docx.",
    );
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new InleesFout("Het Word-bestand kon niet geopend worden. Het is mogelijk beschadigd.");
  }

  const bestand = zip.file(DOCUMENT_PAD);
  if (!bestand) {
    throw new InleesFout(
      "Het bestand bevat geen Word-document (word/document.xml ontbreekt). Gaat het om een .docx en niet om een .doc of een sjabloon?",
    );
  }

  const xml = await bestand.async("string");
  let wortel: XmlNode;
  try {
    wortel = parseXml(xml);
  } catch (e) {
    throw new InleesFout(`Het binnenwerk van het Word-bestand is onleesbaar: ${(e as Error).message}`);
  }

  const lichaam = zoekDiep(wortel, "w:body");
  if (!lichaam) throw new InleesFout("Het Word-bestand bevat geen tekstlichaam.");

  const teller = { streepjes: 0 };
  const blokken: Blok[] = [];
  for (const knoop of lichaam.kinderen) {
    if (knoop.naam === "w:p") {
      const alinea = leesAlinea(knoop, teller);
      if (alinea) blokken.push(alinea);
    } else if (knoop.naam === "w:tbl") {
      const tabel = leesTabel(knoop, teller);
      if (tabel) blokken.push(tabel);
    } else if (knoop.naam === "w:sdt") {
      // Inhoudsbesturingselement: het echte lichaam zit een laag dieper.
      const inhoud = zoekDiep(knoop, "w:sdtContent");
      if (!inhoud) continue;
      for (const binnen of inhoud.kinderen) {
        if (binnen.naam === "w:p") {
          const alinea = leesAlinea(binnen, teller);
          if (alinea) blokken.push(alinea);
        } else if (binnen.naam === "w:tbl") {
          const tabel = leesTabel(binnen, teller);
          if (tabel) blokken.push(tabel);
        }
      }
    }
  }

  return {
    blokken,
    alineas: blokken.filter((b) => b.soort === "alinea").length,
    tabellen: blokken.filter((b) => b.soort === "tabel").length,
    streepjesVervangen: teller.streepjes,
  };
}

interface Teller {
  streepjes: number;
}

/** Tekst van één alinea, met regeleinden voor <w:br/> en een ruimte voor <w:tab/>. */
function alineaTekst(p: XmlNode): string {
  const delen: string[] = [];
  const loop = (knoop: XmlNode): void => {
    for (const k of knoop.kinderen) {
      if (k.naam === "w:t") {
        const tekstKind = k.kinderen.find((x) => x.naam === "#tekst");
        delen.push(tekstKind ? tekstKind.tekst : "");
      } else if (k.naam === "w:br" || k.naam === "w:cr") {
        delen.push("\n");
      } else if (k.naam === "w:tab") {
        delen.push(" ");
      } else if (k.naam === "w:instrText" || k.naam === "w:delText") {
        // Veldcodes en geschrapte tekst horen niet in het verslag.
        continue;
      } else {
        loop(k);
      }
    }
  };
  loop(p);
  return delen.join("");
}

function leesAlinea(p: XmlNode, teller: Teller): Alinea | null {
  const ruw = alineaTekst(p);
  const regels = ruw
    .split("\n")
    .map((r) => {
      teller.streepjes += telStreepjes(r);
      return schoonTekst(r);
    })
    .filter((r) => r !== "");
  if (regels.length === 0) return null;

  const pPr = kind(p, "w:pPr");
  const stijl = pPr ? kind(pPr, "w:pStyle")?.attrs["w:val"] ?? "" : "";
  const opsomming = pPr ? kind(pPr, "w:numPr") !== null : false;
  const kopniveau = leesKopniveau(stijl, pPr);

  const runs = kinderen(p, "w:r").filter((r) => zoekDiep(r, "w:t") !== null);
  const vet =
    runs.length > 0 &&
    runs.every((r) => {
      const rPr = kind(r, "w:rPr");
      if (!rPr) return false;
      const b = kind(rPr, "w:b");
      if (!b) return false;
      const val = b.attrs["w:val"];
      return val === undefined || val === "1" || val === "true" || val === "on";
    });

  return { soort: "alinea", tekst: regels.join(" "), vet, opsomming, kopniveau };
}

/** Kopniveau uit de stijlnaam ("Heading2", "Kop2", "Titel") of uit het schemaniveau. */
function leesKopniveau(stijl: string, pPr: XmlNode | null): number {
  const s = stijl.toLowerCase();
  const m = s.match(/^(heading|kop|titre|rubriek)\s*-?(\d)$/);
  if (m) return Number(m[2]);
  if (s === "title" || s === "titel") return 1;
  if (s === "subtitle" || s === "ondertitel") return 2;
  if (pPr) {
    const niveau = kind(pPr, "w:outlineLvl")?.attrs["w:val"];
    if (niveau !== undefined) {
      const n = Number(niveau);
      if (Number.isFinite(n) && n >= 0 && n <= 8) return n + 1;
    }
  }
  return 0;
}

function leesTabel(tbl: XmlNode, teller: Teller): Tabel | null {
  const rijen: string[][] = [];
  for (const tr of kinderen(tbl, "w:tr")) {
    const cellen: string[] = [];
    for (const tc of kinderen(tr, "w:tc")) {
      const stukken: string[] = [];
      for (const p of kinderen(tc, "w:p")) {
        const ruw = alineaTekst(p);
        for (const regel of ruw.split("\n")) {
          teller.streepjes += telStreepjes(regel);
          const schoon = schoonTekst(regel);
          if (schoon !== "") stukken.push(schoon);
        }
      }
      // Een cel kan zelf een tabel dragen. De tekst daarvan gaat mee als regels,
      // zodat niets verdwijnt, maar de structuur van de binnentabel valt weg.
      for (const binnen of kinderen(tc, "w:tbl")) {
        const diep = leesTabel(binnen, teller);
        if (diep) for (const r of diep.rijen) stukken.push(r.join(" | "));
      }
      cellen.push(stukken.join("\n"));
    }
    if (cellen.length > 0) rijen.push(cellen);
  }
  if (rijen.length === 0) return null;
  if (rijen.every((r) => r.every((c) => c === ""))) return null;
  return { soort: "tabel", rijen };
}
