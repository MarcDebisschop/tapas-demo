import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { omschrijvingVan, duidingVan } from "../server/t4students/rapport-contract";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { renderT4StudentsRapport } from "../server/t4students/rapport-pdf";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";

// ---------------------------------------------------------------------------
// Try Hard is een relationeel construct.
//
// De constructdefinitie van de opdrachtgever luidt: iemand met Try Hard wil
// vooral het verschil maken en iets uitzonderlijks doen VOOR een persoon naar
// wie hij opkijkt, die hem inspireert, en van wie hij weet dat die in hem
// gelooft.
//
// Waarom deze test bestaat: de verleiding is groot om Try Hard te schrijven als
// "hard blijven proberen", "inzet", "doorzetten" of "zich bewijzen". Dat is
// gewone volharding en dat meet het construct niet. Zonder de persoon in de
// tekst valt Try Hard samen met Be Perfect (kwaliteit) en met algemene
// prestatiedrang, en verliest het rapport zijn onderscheid. Deze test houdt de
// drie bestanden waarin Try Hard voor de kandidaat zichtbaar wordt op één lijn:
// het item, de omschrijving naast de naam, en de duidingstekst.
//
// Wat deze test NIET doet: ze legt geen letterlijke formulering vast. Ze eist
// dat de relationele figuur en het uitzonderlijke aanwezig blijven, in welke
// bewoording ook. Zo kan de tekst blijven verbeteren zonder dat de betekenis
// wegglijdt.
// ---------------------------------------------------------------------------

const WORTEL = path.resolve(__dirname, "..");
const CONSTRUCT = "Try Hard";

/** Kijkt iemand op naar een ander, of gelooft die ander in hem: staat dat erin? */
function noemtEenPersoonOmHoogTeZien(tekst: string): boolean {
  const t = tekst.toLowerCase();
  return /opkijk|opkijkt|bewonder|inspireer/.test(t);
}

/** Weet de kandidaat dat die persoon in hem gelooft: staat dat erin? */
function noemtVertrouwenVanDiePersoon(tekst: string): boolean {
  const t = tekst.toLowerCase();
  return /gelooft in|in mij gelooft|in jou gelooft|in je gelooft|in hem gelooft|in haar gelooft/.test(
    t,
  );
}

/** Gaat het om iets uitzonderlijks of om het verschil maken? */
function noemtIetsUitzonderlijks(tekst: string): boolean {
  const t = tekst.toLowerCase();
  return /uitzonderlijk|uitblink|het verschil (te )?mak|verschil maken/.test(t);
}

// De korte omschrijving naast de constructnaam staat in een kolom van 162 punten
// breed en mag niet afbreken. Daarin passen de relationele figuur en het
// uitzonderlijke wel samen, het vertrouwen niet meer. Het vertrouwen wordt
// daarom bij het item en bij de duidingstekst afgedwongen, waar de ruimte er is.
const OMSCHRIJVING_MAX_TEKENS = 46;

describe("het Try Hard-item draagt de relationele figuur", () => {
  const item = I.sections
    .flatMap((s: { items?: unknown[] }) => (s.items ?? []) as Record<string, any>[])
    .find((it) => it.construct === CONSTRUCT && it.scale === "recognition");

  it("er is een herkenningsitem voor Try Hard", () => {
    expect(item, "geen herkenningsitem met construct Try Hard").toBeTruthy();
  });

  it("de Nederlandse tekst noemt de persoon naar wie de kandidaat opkijkt", () => {
    expect(noemtEenPersoonOmHoogTeZien(item!.text.nl), item!.text.nl).toBe(true);
  });

  it("de Nederlandse tekst noemt dat die persoon in de kandidaat gelooft", () => {
    expect(noemtVertrouwenVanDiePersoon(item!.text.nl), item!.text.nl).toBe(true);
  });

  it("de Nederlandse tekst gaat over iets uitzonderlijks of het verschil maken", () => {
    expect(noemtIetsUitzonderlijks(item!.text.nl), item!.text.nl).toBe(true);
  });

  it("de tekst gaat niet over gewone volharding zonder persoon", () => {
    // "blijven proberen" en "doorzetten" zonder relationele figuur is precies
    // de verschuiving die dit construct onbruikbaar maakt.
    const t = item!.text.nl.toLowerCase();
    if (/blijven proberen|doorzetten|volharding/.test(t)) {
      expect(noemtEenPersoonOmHoogTeZien(t) && noemtVertrouwenVanDiePersoon(t), item!.text.nl).toBe(
        true,
      );
    }
  });

  it("de drie talen dragen dezelfde figuur: opkijken en vertrouwen", () => {
    const fr = item!.text.fr.toLowerCase();
    const en = item!.text.en.toLowerCase();
    expect(/admire|inspire/.test(fr), item!.text.fr).toBe(true);
    expect(/croit en moi|croit en/.test(fr), item!.text.fr).toBe(true);
    expect(/exceptionnel|la différence/.test(fr), item!.text.fr).toBe(true);
    expect(/look up to|admire|inspires/.test(en), item!.text.en).toBe(true);
    expect(/believes in me|believes in/.test(en), item!.text.en).toBe(true);
    expect(/exceptional|the difference/.test(en), item!.text.en).toBe(true);
  });
});

describe("de omschrijving naast de naam Try Hard draagt de relationele figuur", () => {
  it("noemt de persoon naar wie de kandidaat opkijkt", () => {
    const o = omschrijvingVan(CONSTRUCT);
    expect(o, "er is geen omschrijving voor Try Hard").not.toBe("");
    expect(noemtEenPersoonOmHoogTeZien(o), o).toBe(true);
  });

  it("gaat over iets uitzonderlijks of het verschil maken", () => {
    expect(noemtIetsUitzonderlijks(omschrijvingVan(CONSTRUCT)), omschrijvingVan(CONSTRUCT)).toBe(
      true,
    );
  });

  it("blijft kort genoeg voor de kolom in de rangorde", () => {
    const o = omschrijvingVan(CONSTRUCT);
    expect(o.length, `de omschrijving "${o}" breekt af in de rangordekolom`).toBeLessThanOrEqual(
      OMSCHRIJVING_MAX_TEKENS,
    );
  });
});

describe("de duidingstekst bij Try Hard draagt de relationele figuur", () => {
  const tekst = duidingVan(CONSTRUCT);

  it("er is een duidingstekst", () => {
    expect(tekst.length).toBeGreaterThan(200);
  });

  it("noemt de persoon naar wie de kandidaat opkijkt", () => {
    expect(noemtEenPersoonOmHoogTeZien(tekst), tekst).toBe(true);
  });

  it("noemt dat die persoon in de kandidaat gelooft", () => {
    expect(noemtVertrouwenVanDiePersoon(tekst), tekst).toBe(true);
  });

  it("noemt het verschil maken of iets uitzonderlijks", () => {
    expect(noemtIetsUitzonderlijks(tekst), tekst).toBe(true);
  });

  it("noemt het risico dat de inzet aan die ene persoon hangt", () => {
    // Dit is de keerzijde die bij dit construct hoort en die in een
    // ontwikkelrapport benoemd moet worden: valt de figuur weg, dan valt de
    // beweging weg. Zonder die zin leest Try Hard als een pure sterkte.
    expect(/die ene persoon|zodra die er niet meer is|wegvalt|zakt je motivatie/.test(tekst), tekst).toBe(
      true,
    );
  });

  it("blijft binnen de lengte van de andere duidingsteksten", () => {
    const bestand = JSON.parse(
      readFileSync(path.join(WORTEL, "server", "data", "t4students-duidingsteksten.json"), "utf-8"),
    ) as { constructen: Record<string, { tekst: string }> };
    const lengtes = Object.values(bestand.constructen).map((d) => d.tekst.length);
    const langste = Math.max(...lengtes.filter((l) => l !== tekst.length));
    // Een tekst die veel langer is dan de rest loopt op één blad over de rand.
    expect(tekst.length).toBeLessThanOrEqual(Math.round(langste * 1.1));
  });
});

// ---------------------------------------------------------------------------
// De opmaakwachter die bij deze wijziging ontbrak.
//
// De opmaak meldt zelf wanneer een regel die niet mag afbreken breder is dan
// haar plaats ("loopt over haar plaats heen"). Die melding werd tot nu toe door
// geen enkele test gelezen, waardoor een langere omschrijving stil over de rand
// van haar kolom kon lopen. Bij deze wijziging gebeurde dat ook: de eerste,
// langere omschrijving bij Try Hard was 184 punten breed in een kolom van 162 en
// brak op twee bladen af tegen de rij eronder. Alleen het blad met het oog
// bekijken toonde dat; niets hield het tegen. Deze toets doet dat nu wel, voor
// het hele rapport en dus ook voor elke volgende tekstwijziging.
// ---------------------------------------------------------------------------

describe("geen enkele vaste regel in het rapport loopt over haar plaats heen", () => {
  it("de opmaak meldt geen overlopende regel op het voorbeeldrapport", () => {
    const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    });
    const { meldingen } = renderT4StudentsRapport(rapport);
    const overloop = meldingen.filter((m) => m.includes("loopt over haar plaats heen"));
    expect(overloop, overloop.join("\n")).toHaveLength(0);
  });
});
