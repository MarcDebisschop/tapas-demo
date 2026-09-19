// ---------------------------------------------------------------------------
// server/notulen-toc/xml.ts  -  NIEUW BESTAND
//
// Een kleine XML-lezer, alleen voor het binnenwerk van een Word-bestand.
//
// Waarom niet met reguliere uitdrukkingen: het binnenwerk van een Word-bestand
// nestelt alinea's in cellen en cellen in tabellen, en een tabel kan opnieuw een
// tabel bevatten. Een uitdrukking die op <w:p ...> knipt, haalt die nesting
// altijd door elkaar en levert dan tekst in de verkeerde cel. Een boom lezen is
// een pagina code en geeft daarna zekerheid.
//
// Waarom geen bibliotheek: het platform draagt geen XML-lezer, en één erbij
// halen voor deze ene weg is zwaarder dan deze pagina. De lezer kent alleen wat
// in een docx voorkomt: elementen, kenmerken, tekst, zelfsluitende tags,
// commentaar, de XML-verklaring en CDATA. Naamruimtes blijven letterlijk staan
// ("w:p" blijft "w:p"), want de omzetter zoekt op die volle namen.
// ---------------------------------------------------------------------------

/** Naam die een tekstknoop draagt; een echte elementnaam kan dit nooit zijn. */
export const TEKSTKNOOP = "#tekst";

export interface XmlNode {
  naam: string;
  attrs: Record<string, string>;
  kinderen: XmlNode[];
  /** Alleen gevuld bij een tekstknoop. */
  tekst: string;
}

function nieuweKnoop(naam: string): XmlNode {
  return { naam, attrs: {}, kinderen: [], tekst: "" };
}

const ENTITEITEN: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

/** Zet XML-entiteiten om in gewone tekens, inclusief &#38; en &#x26;. */
export function ontsnapAf(ruw: string): string {
  return ruw.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (heel, kern: string) => {
    if (kern.startsWith("#x") || kern.startsWith("#X")) {
      const code = Number.parseInt(kern.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : heel;
    }
    if (kern.startsWith("#")) {
      const code = Number.parseInt(kern.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : heel;
    }
    const vast = ENTITEITEN[kern];
    return vast === undefined ? heel : vast;
  });
}

function leesAttributen(ruw: string): Record<string, string> {
  const uit: Record<string, string> = {};
  const patroon = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = patroon.exec(ruw)) !== null) {
    uit[m[1]] = ontsnapAf(m[3] ?? m[4] ?? "");
  }
  return uit;
}

/**
 * Leest een XML-tekst en levert de buitenste elementknoop.
 * Werpt bij onleesbare invoer, zodat de route een nette melding kan geven in
 * plaats van stil een leeg verslag af te leveren.
 */
export function parseXml(bron: string): XmlNode {
  const wortel = nieuweKnoop("#wortel");
  const stapel: XmlNode[] = [wortel];
  let i = 0;
  const n = bron.length;

  while (i < n) {
    const opening = bron.indexOf("<", i);
    if (opening === -1) {
      voegTekstToe(stapel[stapel.length - 1], bron.slice(i));
      break;
    }
    if (opening > i) {
      voegTekstToe(stapel[stapel.length - 1], bron.slice(i, opening));
    }

    // Verklaring, commentaar, doctype en CDATA overslaan of als tekst opnemen.
    if (bron.startsWith("<?", opening)) {
      const eind = bron.indexOf("?>", opening);
      i = eind === -1 ? n : eind + 2;
      continue;
    }
    if (bron.startsWith("<!--", opening)) {
      const eind = bron.indexOf("-->", opening);
      i = eind === -1 ? n : eind + 3;
      continue;
    }
    if (bron.startsWith("<![CDATA[", opening)) {
      const eind = bron.indexOf("]]>", opening);
      const inhoud = bron.slice(opening + 9, eind === -1 ? n : eind);
      const knoop = nieuweKnoop(TEKSTKNOOP);
      knoop.tekst = inhoud;
      stapel[stapel.length - 1].kinderen.push(knoop);
      i = eind === -1 ? n : eind + 3;
      continue;
    }
    if (bron.startsWith("<!", opening)) {
      const eind = bron.indexOf(">", opening);
      i = eind === -1 ? n : eind + 1;
      continue;
    }

    const sluiting = bron.indexOf(">", opening);
    if (sluiting === -1) throw new Error("Onafgesloten XML-tag in het Word-bestand.");
    const binnen = bron.slice(opening + 1, sluiting);

    if (binnen.startsWith("/")) {
      const naam = binnen.slice(1).trim();
      // Sluit af tot en met de eerste open knoop met deze naam. Zo loopt een
      // ontbrekende sluittag de rest van de boom niet in de war.
      for (let d = stapel.length - 1; d >= 1; d--) {
        if (stapel[d].naam === naam) {
          stapel.length = d;
          break;
        }
      }
      i = sluiting + 1;
      continue;
    }

    const zelfsluitend = binnen.endsWith("/");
    const kern = zelfsluitend ? binnen.slice(0, -1) : binnen;
    const ruimte = kern.search(/\s/);
    const naam = (ruimte === -1 ? kern : kern.slice(0, ruimte)).trim();
    if (naam === "") throw new Error("Lege XML-tagnaam in het Word-bestand.");
    const knoop = nieuweKnoop(naam);
    if (ruimte !== -1) knoop.attrs = leesAttributen(kern.slice(ruimte));
    stapel[stapel.length - 1].kinderen.push(knoop);
    if (!zelfsluitend) stapel.push(knoop);
    i = sluiting + 1;
  }

  const eerste = wortel.kinderen.find((k) => k.naam !== TEKSTKNOOP);
  if (!eerste) throw new Error("Geen XML-element gevonden in het Word-bestand.");
  return eerste;
}

function voegTekstToe(ouder: XmlNode, ruw: string): void {
  if (ruw === "") return;
  const knoop = nieuweKnoop(TEKSTKNOOP);
  knoop.tekst = ontsnapAf(ruw);
  ouder.kinderen.push(knoop);
}

/** Directe kinderen met deze naam. */
export function kinderen(knoop: XmlNode, naam: string): XmlNode[] {
  return knoop.kinderen.filter((k) => k.naam === naam);
}

/** Het eerste directe kind met deze naam, of null. */
export function kind(knoop: XmlNode, naam: string): XmlNode | null {
  return knoop.kinderen.find((k) => k.naam === naam) ?? null;
}

/** De eerste afstammeling met deze naam, op elke diepte, of null. */
export function zoekDiep(knoop: XmlNode, naam: string): XmlNode | null {
  for (const k of knoop.kinderen) {
    if (k.naam === naam) return k;
    const diep = zoekDiep(k, naam);
    if (diep) return diep;
  }
  return null;
}

/** Alle afstammelingen met deze naam, op elke diepte, in documentorde. */
export function zoekAlleDiep(knoop: XmlNode, naam: string): XmlNode[] {
  const uit: XmlNode[] = [];
  const loop = (n: XmlNode): void => {
    for (const k of n.kinderen) {
      if (k.naam === naam) uit.push(k);
      loop(k);
    }
  };
  loop(knoop);
  return uit;
}
