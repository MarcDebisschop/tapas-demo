import { describe, it, expect } from "vitest";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { T4STUDENTS_INSTRUMENT } from "../server/t4students/instrument";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";

// ---------------------------------------------------------------------------
// Het rapport moet eerlijk zijn over de smalle basis onder zijn rangordes.
//
// De feitelijke situatie in de bank: op één uitzondering na rust elk construct
// op één herkenningsitem, en dat item heeft vier antwoordmogelijkheden. De
// rangschikking gebeurt op die score, en scores die niet meer dan de
// gelijkstandsmarge uit elkaar liggen komen in dezelfde groep. Die marge staat
// op 0.3, terwijl één item alleen hele getallen kan opleveren. Gevolg: één stap
// verschil op één vraag levert een eigen groep op en wordt in het rapport tot
// een uitspraak over de student.
//
// Dat is geen rekenfout, het is een grens van het ontwerp. Zolang er per
// construct één item is, kan het rapport niet weten of een verschil van één
// stap iets over de persoon zegt of over de vraag. Het rapport mag die rangorde
// wel tonen, want zonder rangorde is het als gespreksdocument onbruikbaar, maar
// het moet er dan ook bij zeggen waarop een lijn rust en hoe groot een verschil
// moet zijn voor het iets betekent.
//
// Deze test houdt twee dingen vast:
//   1. de uitleg over die ene stelling staat op de pagina waar de rangordes tot
//      uitspraken worden, niet alleen achteraan bij de verantwoording;
//   2. het rapport doet geen categorische uitspraak over een construct alsof ze
//      vaststaat, maar bindt ze aan de momentopname.
//
// Deze test vervalt niet wanneer er items bijkomen. Ze wordt dan juist
// belangrijker: bij meerdere items per construct moet de tekst mee veranderen,
// en dan zakt deze test en dwingt ze dat gesprek af.
// ---------------------------------------------------------------------------

function bouw() {
  const resultaat = scoreStudiekompas(
    T4STUDENTS_INSTRUMENT,
    VOORBEELDAFNAME.antwoorden,
    null,
    "nl",
  );
  return bouwT4StudentsRapport(
    T4STUDENTS_INSTRUMENT,
    resultaat,
    VOORBEELDAFNAME.antwoorden,
    "verdieping",
    {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: T4STUDENTS_INSTRUMENT.version,
    },
  );
}

/** Alle tekst van één pagina, hoe die pagina ook is opgebouwd. */
function tekstVan(pagina: { blokken: Record<string, any>[] }): string {
  const stukken: string[] = [];
  for (const blok of pagina.blokken) {
    for (const veld of ["tekst", "kop", "opschrift", "titel"]) {
      if (typeof blok[veld] === "string") stukken.push(blok[veld]);
    }
    if (Array.isArray(blok.punten)) stukken.push(...blok.punten.filter((p: unknown) => typeof p === "string"));
  }
  return stukken.join(" ");
}

describe("de aandachtspuntenpagina zegt waarop haar punten rusten", () => {
  const rapport = bouw();
  const aandachtspunten = rapport.paginas.find((p: { titel: string }) =>
    p.titel.startsWith("Aandachtspunten"),
  );

  it("de pagina bestaat", () => {
    expect(aandachtspunten, "de aandachtspuntenpagina is niet gevonden").toBeTruthy();
  });

  it("noemt dat een onderdeel op één stelling rust", () => {
    const t = tekstVan(aandachtspunten!);
    expect(/op \u00e9\u00e9n stelling|op een enkele stelling/.test(t), t).toBe(true);
  });

  it("zegt dat een verschil van één stap ook aan de vraag kan liggen", () => {
    const t = tekstVan(aandachtspunten!);
    expect(/verschil van \u00e9\u00e9n stap/.test(t), t).toBe(true);
    expect(/aan die ene vraag liggen/.test(t), t).toBe(true);
  });

  it("laat de student ruimte om een punt niet te herkennen", () => {
    const t = tekstVan(aandachtspunten!);
    expect(/geen fout van jou/.test(t), t).toBe(true);
  });
});

describe("het rapport doet geen vaststaande uitspraak over één construct", () => {
  it("bindt de laagste focus aan de momentopname", () => {
    const rapport = bouw();
    const alles = rapport.paginas.map((p: { blokken: Record<string, any>[] }) => tekstVan(p)).join(" ");
    // De oude formulering las als een eigenschap: "X is de focus waarin je
    // jezelf het minst herkent". Ze rustte op één antwoord.
    expect(/is de focus waarin je jezelf het minst herkent/.test(alles), "vaststaande uitspraak").toBe(
      false,
    );
    expect(/In deze momentopname herkende je jezelf het minst in/.test(alles), alles.slice(0, 200)).toBe(
      true,
    );
  });
});
