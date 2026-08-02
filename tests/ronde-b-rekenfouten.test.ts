// ---------------------------------------------------------------------------
// tests/ronde-b-rekenfouten.test.ts
//
// Ronde B. Vier rekenkundige punten vastzetten:
//   1. T4Sports module 2 (flow): de normtabel loopt over de somscore van de
//      twee items van een schaal, niet over het gemiddelde.
//   2. T4Sports consistentie: koppeling op itemsleutel, niet op positie in een
//      gefilterde lijst.
//   3. T4Organizations: het vermogensgemiddelde weegt per ring, niet per hoofd.
//   5. Driver-scan: het knippunt tussen gaspedaal en rem is een benoemde
//      constante en komt nergens meer los voor.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scoreModule } from "../server/t4sports/module-scoring";
import { ITEM_ENERGIE_MAX, ITEM_ENERGIE_MIN } from "../shared/energie-schaal";
import { buildT4SportsContract, type Responses } from "../server/t4sports/scoring";
import { hydrateInstrument } from "../server/instrument";
import t4sportsJson from "../server/data/t4sports.json";
import { scoorOrganisatie } from "../server/t4organizations/scoring";
import { itemsVoorRing } from "../server/t4organizations/instrument";
import type { T4ORespondentMetAntwoorden } from "../server/t4organizations/storage";
import { itembank as teamscanItembank, scoorIndividueel } from "../server/teamscan/scoring";

const t4sportsInstrument = hydrateInstrument(t4sportsJson);

const WORTEL = join(__dirname, "..");
const lees = (p: string) => readFileSync(join(WORTEL, p), "utf-8");

// ---------------------------------------------------------------------------
// Punt 1: T4Sports module 2, perfecte score hoort het hoogste label te krijgen
// ---------------------------------------------------------------------------
describe("T4Sports module 2, normlabel bij een perfecte invulling", () => {
  // Module 2 heeft 18 items, elk op een schaal van 1 tot en met 5, verdeeld
  // over negen schalen van twee items. Overal 5 is dus de best mogelijke
  // invulling.
  const allesMaximaal: Record<string, number> = {};
  for (let nr = 1; nr <= 18; nr++) allesMaximaal[String(nr)] = 5;

  const allesMinimaal: Record<string, number> = {};
  for (let nr = 1; nr <= 18; nr++) allesMinimaal[String(nr)] = 1;

  it("geeft bij overal het maximum het hoogste normlabel, niet het laagste", () => {
    const resultaat = scoreModule({ moduleId: "M2", antwoorden: allesMaximaal });
    for (const schaal of resultaat.schalen) {
      expect(schaal.score).toBe(10);
      expect(schaal.gemiddelde).toBe(5);
      expect(schaal.normLabel).toBe("Diepe flow");
    }
  });

  it("geeft bij overal het minimum het laagste normlabel", () => {
    const resultaat = scoreModule({ moduleId: "M2", antwoorden: allesMinimaal });
    for (const schaal of resultaat.schalen) {
      expect(schaal.score).toBe(2);
      expect(schaal.normLabel).toBe("Weinig flow");
    }
  });

  it("laat het label oplopen als de antwoorden oplopen", () => {
    const labelBijWaarde = (waarde: number) => {
      const antwoorden: Record<string, number> = {};
      for (let nr = 1; nr <= 18; nr++) antwoorden[String(nr)] = waarde;
      return scoreModule({ moduleId: "M2", antwoorden }).schalen[0].normLabel;
    };
    expect(labelBijWaarde(1)).toBe("Weinig flow"); // som 2
    expect(labelBijWaarde(2)).toBe("Weinig flow"); // som 4
    expect(labelBijWaarde(3)).toBe("Weinig flow"); // som 6
    expect(labelBijWaarde(4)).toBe("Regelmatige flow"); // som 8
    expect(labelBijWaarde(5)).toBe("Diepe flow"); // som 10
  });

  it("laat een overgeslagen item de schaal niet in het laagste vakje vallen", () => {
    // Eén van de twee items van de eerste schaal (items 1 en 10) ontbreekt.
    const antwoorden: Record<string, number> = {};
    for (let nr = 1; nr <= 18; nr++) antwoorden[String(nr)] = 5;
    delete antwoorden["10"];
    const resultaat = scoreModule({ moduleId: "M2", antwoorden });
    const eerste = resultaat.schalen.find((s) => s.id === "challenge_skill")!;
    expect(eerste.gemiddelde).toBe(5);
    expect(eerste.normLabel).toBe("Diepe flow");
  });
});

// ---------------------------------------------------------------------------
// Punt 2: T4Sports consistentie, een overgeslagen vraag mag niets verschuiven
// ---------------------------------------------------------------------------
describe("T4Sports consistentie bij een overgeslagen vraag", () => {
  // De blokken B0 tot en met B9 vragen energie per gekozen item, B10 en verder
  // vragen energie voor het hele blok. Precies op die overgang loopt het mis
  // zodra de gefilterde antwoordlijst op positie aan de blokken wordt gekoppeld.
  const ITEM_BLOKKEN = 10;
  const AANTAL_BLOKKEN = t4sportsInstrument.blocks.length;

  function volledigeAntwoorden(): Responses {
    const responses: Responses = {};
    t4sportsInstrument.blocks.forEach((blok, idx) => {
      const items = blok.items;
      responses["B" + idx] =
        idx < ITEM_BLOKKEN
          ? {
              most: items[0].id,
              least: items[1].id,
              itemEnergy: { most: 1, least: -1 },
              blockEnergy: null,
            }
          : {
              most: items[0].id,
              least: items[1].id,
              itemEnergy: { most: null, least: null },
              blockEnergy: 1,
            };
    });
    return responses;
  }

  const contractVoor = (responses: Responses) =>
    buildT4SportsContract({
      respondentCode: "TEST-B2",
      name: "Testdeelnemer",
      baselineEnergy: 5,
      responses,
      connection: { q1: 3, q2: 3, q3: 3, q4: 3 },
    });

  it("telt bij een volledige invulling alle 34 blokken mee", () => {
    expect(AANTAL_BLOKKEN).toBe(34);
    expect(contractVoor(volledigeAntwoorden()).sections.meta.consistency.score).toBe(100);
  });

  it("geeft dezelfde consistentie ongeacht welk blok wordt overgeslagen", () => {
    // Welk enkel blok ook ontbreekt, er blijven evenveel geldige antwoorden
    // over. De consistentie hoort dus in alle gevallen gelijk te zijn. Op de
    // oude code gaf een overgeslagen blok uit het begin 97 en een overgeslagen
    // blok verderop 98, omdat de gefilterde lijst een blok opschoof en het
    // eerste blok met blokenergie tegen een blok met item-energie werd gelegd.
    const scores = new Map<string, number>();
    for (const teMissen of ["B0", "B4", "B9", "B10", "B20", "B33"]) {
      const responses = volledigeAntwoorden();
      delete responses[teMissen];
      scores.set(teMissen, contractVoor(responses).sections.meta.consistency.score);
    }
    expect([...new Set(scores.values())]).toEqual([98]);
  });
});

// ---------------------------------------------------------------------------
// Punt 3: T4Organizations, elke ring weegt even zwaar in het organisatiecijfer
// ---------------------------------------------------------------------------
describe("T4Organizations, weging van de ringen in het vermogensgemiddelde", () => {
  const DIMENSIE = "identiteitscoherentie";
  const RING_VAN_GROEP = { leiding: "binnen", medewerker: "midden", stakeholder: "buiten" } as const;

  // Bouwt een respondent die op elk identiteitscoherentie-item van zijn ring
  // dezelfde waarde na omkering geeft. Omgekeerde items krijgen 6 min de waarde,
  // zodat de scoring er de bedoelde waarde van maakt.
  function respondent(groep: keyof typeof RING_VAN_GROEP, waardeNaOmkering: number) {
    const ring = RING_VAN_GROEP[groep];
    const antwoorden: Record<string, number> = {};
    for (const item of itemsVoorRing(ring)) {
      if (item.dimensie !== DIMENSIE) continue;
      if (item.itemType !== "likert" && item.itemType !== "congruence") continue;
      antwoorden[item.id] = item.reverse ? 6 - waardeNaOmkering : waardeNaOmkering;
    }
    return { groep, antwoorden } as T4ORespondentMetAntwoorden;
  }

  const scoreVoorDimensie = (respondenten: T4ORespondentMetAntwoorden[]) =>
    scoorOrganisatie(respondenten).vermogens.find((v) => v.dimensie === DIMENSIE)!.score!;

  it("laat een grote middenring het organisatiecijfer niet meer bepalen", () => {
    // Een leiding die hoog scoort, twintig medewerkers die laag scoren en drie
    // stakeholders die hoog scoren. Per hoofd geteld komt daar 1,3 uit: het
    // cijfer van de middenring. Per ring geteld komt daar (5 + 1 + 5) / 3 uit.
    const respondenten = [
      respondent("leiding", 5),
      ...Array.from({ length: 20 }, () => respondent("medewerker", 1)),
      ...Array.from({ length: 3 }, () => respondent("stakeholder", 5)),
    ];
    expect(scoreVoorDimensie(respondenten)).toBeCloseTo((5 + 1 + 5) / 3, 6);
  });

  it("verlaagt het cijfer niet wanneer een ring helemaal leeg is", () => {
    // Geen enkele stakeholder. De buitenring mag dan niet als een nul meetellen.
    const respondenten = [
      respondent("leiding", 4),
      ...Array.from({ length: 20 }, () => respondent("medewerker", 4)),
    ];
    expect(scoreVoorDimensie(respondenten)).toBeCloseTo(4, 6);
  });

  it("geeft hetzelfde cijfer bij een scheve en een gelijke verdeling over de ringen", () => {
    const scheef = [
      respondent("leiding", 5),
      ...Array.from({ length: 30 }, () => respondent("medewerker", 3)),
      respondent("stakeholder", 4),
    ];
    const gelijk = [
      respondent("leiding", 5),
      respondent("medewerker", 3),
      respondent("stakeholder", 4),
    ];
    expect(scoreVoorDimensie(scheef)).toBeCloseTo(scoreVoorDimensie(gelijk), 6);
  });
});

// ---------------------------------------------------------------------------
// Punt 4: Teamscan, het veld `dimensie` is beschrijvend en rekent niet mee
// ---------------------------------------------------------------------------
describe("Teamscan, het subveld dimensie bij de fundamentitems", () => {
  const fundamentItems = teamscanItembank.blokken.A_fundament.items as {
    id: string;
    dimensie: string;
  }[];

  const antwoordenVoor = (perItem: (id: string) => number) => ({
    fundament: Object.fromEntries(fundamentItems.map((i) => [i.id, perItem(i.id)])),
    lencioni: {} as Record<string, number>,
    vertrouwenRanking: {} as Record<string, number>,
    vertrouwenPrestatie: {} as Record<string, number>,
  });

  it("is bij elk fundamentitem ingevuld", () => {
    expect(fundamentItems).toHaveLength(8);
    for (const item of fundamentItems) {
      expect(["professioneel", "persoonlijk", "proces"]).toContain(item.dimensie);
    }
  });

  it("staat als beschrijvend gedocumenteerd in de itembank", () => {
    expect(teamscanItembank.blokken.A_fundament._dimensie).toMatch(/beschrijvend/);
  });

  it("laat elk item even zwaar tellen, ongeacht zijn dimensie", () => {
    // Er is een enkel procesitem (F7) en drie persoonlijke items. Als de scoring
    // per dimensie zou wegen, zou een hoge score op alleen het procesitem
    // zwaarder tellen dan een hoge score op een van de persoonlijke items. Dat
    // is niet zo: het fundamentcijfer is het gewone gemiddelde van acht items.
    const alleenProcesHoog = antwoordenVoor((id) => (id === "F7" ? 5 : 1));
    const alleenPersoonlijkHoog = antwoordenVoor((id) => (id === "F5" ? 5 : 1));
    const a = scoorIndividueel(alleenProcesHoog).fundament.gemiddelde;
    const b = scoorIndividueel(alleenPersoonlijkHoog).fundament.gemiddelde;
    expect(a).toBe(b);
    expect(a).toBe((5 + 7 * 1) / 8);
  });
});

// ---------------------------------------------------------------------------
// Punt 5: Driver-scan, het knippunt tussen gaspedaal en rem heeft een naam
// ---------------------------------------------------------------------------
describe("Driver-scan, knippunt tussen gaspedaal en rem", () => {
  it("staat als benoemde constante op het midden van de energie-itemschaal", async () => {
    const mod = await import("../server/driverscan/duiding");
    expect(mod.GASPEDAAL_REM_GRENS).toBe(0);
    expect(mod.GASPEDAAL_REM_GRENS).toBe((ITEM_ENERGIE_MIN + ITEM_ENERGIE_MAX) / 2);
  });

  it("komt in de rapportcode niet meer als los getal voor", () => {
    const bron = lees("server/driverscan/rapport-pdf.ts");
    expect(bron).toContain("GASPEDAAL_REM_GRENS");
    // Geen losse vergelijking met 0 meer op de energiewaarde van een driver.
    expect(bron).not.toMatch(/avg\s*>=?\s*0\b/);
  });
});
