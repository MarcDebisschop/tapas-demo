import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { T4STUDENTS_INSTRUMENT } from "../server/t4students/instrument";

// ---------------------------------------------------------------------------
// Het enige punt waarop de overgezette motor iets anders oplevert dan de bron.
//
// De vier alertboodschappen staan in de motorcode zelf, in drie talen. In twee
// van die vier zinnen staat in de bron een lang streepje. De huisregel van dit
// platform verbiedt lange streepjes in code, commentaar, committeksten en
// verslag. Bij het overzetten is dat streepje daarom vervangen door een punt of
// een komma. De betekenis is ongewijzigd; de tekst is niet letterlijk gelijk.
//
// Deze test pint dat verschil vast, zin voor zin. Wie een van de zes zinnen
// verandert, of wie ergens een zevende afwijking introduceert, krijgt hier een
// rode test. De brontekst wordt niet uit een codebestand gehaald maar uit de
// bevroren uitkomsten in tests/t4students-gelijkheidstoets/uitkomsten/, want
// dat is wat de originele motor werkelijk uitstuurde.
// ---------------------------------------------------------------------------

const hier = path.resolve(__dirname, "t4students-gelijkheidstoets");

const patronen: any[] = JSON.parse(readFileSync(path.join(hier, "patronen.json"), "utf-8"));

/** Elke combinatie van alert en taal die in de bevroren uitkomsten voorkomt. */
function bronteksten(): Map<string, string> {
  const uit = new Map<string, string>();
  for (const bestand of readdirSync(path.join(hier, "uitkomsten"))) {
    if (!bestand.endsWith(".json")) continue;
    const r = JSON.parse(readFileSync(path.join(hier, "uitkomsten", bestand), "utf-8"));
    for (const a of r.alerts?.actief ?? []) uit.set(`${r.taal}|${a.id}`, a.boodschap);
  }
  return uit;
}

/** Wat de overgezette motor voor diezelfde combinaties uitstuurt. */
function nieuweteksten(): Map<string, string> {
  const uit = new Map<string, string>();
  for (const p of patronen) {
    const r = scoreStudiekompas(T4STUDENTS_INSTRUMENT, p.antwoorden, p.deelnemer, p.taal);
    for (const a of r.alerts.actief) uit.set(`${r.taal}|${a.id}`, a.boodschap);
  }
  return uit;
}

// Het teken waar het allemaal om draait, als escape geschreven. Zo staat het
// nergens letterlijk in een bestand van deze repository, terwijl de test wel
// precies op dat teken vergelijkt.
const LANG = "\u2014";
const KORT = "\u2013";

// De volledige lijst van afwijkingen, letterlijk. Er zijn er zes en niet meer.
// Sleutel is taal|alert-id; de waarden zijn het stuk brontekst dat wijzigde en
// wat er nu staat.
const AFWIJKINGEN: Record<string, [string, string]> = {
  "nl|beeld_niet_in_energie": [`te bekijken ${LANG} niet alleen.`, "te bekijken, niet alleen."],
  "fr|beeld_niet_in_energie": [`quelqu’un ${LANG} pas seul.`, "quelqu’un, pas seul."],
  "en|beeld_niet_in_energie": [`with someone ${LANG} not alone.`, "with someone, not alone."],
  "nl|voorlopig_profiel": [`is voorlopig ${LANG} vul de vragenlijst`, "is voorlopig. Vul de vragenlijst"],
  "fr|voorlopig_profiel": [`est provisoire ${LANG} réponds entièrement`, "est provisoire. Réponds entièrement"],
  "en|voorlopig_profiel": [`is provisional ${LANG} complete the full`, "is provisional. Complete the full"],
};

describe("alertteksten: het enige verschil met de originele motor", () => {
  const bron = bronteksten();
  const nieuw = nieuweteksten();

  it("alle vier de alerts zijn in alle drie de talen vastgelegd", () => {
    const verwacht: string[] = [];
    for (const taal of ["nl", "fr", "en"]) {
      for (const id of ["beeld_niet_in_energie", "profiel_B_vastloper", "lage_batterij", "voorlopig_profiel"]) {
        verwacht.push(`${taal}|${id}`);
      }
    }
    const ontbreekt = verwacht.filter((k) => !bron.has(k));
    expect(ontbreekt, `deze combinaties komen in geen enkel patroon voor: ${ontbreekt.join(", ")}`)
      .toEqual([]);
    expect([...nieuw.keys()].sort()).toEqual([...bron.keys()].sort());
  });

  it("de zes gewijzigde zinnen wijken precies af zoals hier beschreven", () => {
    for (const [sleutel, [voor, na]] of Object.entries(AFWIJKINGEN)) {
      const bronzin = bron.get(sleutel);
      expect(bronzin, `geen brontekst voor ${sleutel}`).toBeDefined();
      expect(bronzin, `${sleutel}: de brontekst bevat dit stuk niet meer`).toContain(voor);
      expect(nieuw.get(sleutel), `${sleutel} wijkt anders af dan beschreven`)
        .toBe(bronzin!.split(voor).join(na));
    }
  });

  it("de zes andere zinnen zijn letterlijk gelijk aan de bron", () => {
    const ongewijzigd = [...bron.keys()].filter((k) => !(k in AFWIJKINGEN));
    expect(ongewijzigd.length).toBe(6);
    for (const sleutel of ongewijzigd) {
      expect(nieuw.get(sleutel), `${sleutel} had niet mogen wijzigen`).toBe(bron.get(sleutel));
    }
  });

  it("geen enkele alerttekst van de overgezette motor bevat nog een lang streepje", () => {
    for (const [sleutel, zin] of nieuw) {
      expect(zin.includes(LANG) || zin.includes(KORT), `${sleutel} bevat nog een lang streepje`).toBe(false);
    }
  });

  it("de rest van het alert, id en meaning en toHuman, komt uit het instrument en is ongewijzigd", () => {
    // meaning en toHuman komen uit scoringMap.alertOverride en niet uit de
    // motorcode. Ze mogen dus nergens afwijken.
    for (const p of patronen) {
      const r = scoreStudiekompas(T4STUDENTS_INSTRUMENT, p.antwoorden, p.deelnemer, p.taal);
      const vast = JSON.parse(
        readFileSync(path.join(hier, "uitkomsten", `${p.naam}.json`), "utf-8"),
      );
      const zonder = (l: any[]) => l.map((a) => ({ id: a.id, meaning: a.meaning, toHuman: a.toHuman }));
      expect(zonder(r.alerts.actief), `${p.naam}`).toEqual(zonder(vast.alerts.actief));
    }
  });
});
