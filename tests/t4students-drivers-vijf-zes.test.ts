import { describe, it, expect } from "vitest";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";

// ---------------------------------------------------------------------------
// Punt 5 uit fase 1: "de familie Drivers noemt vijf constructen voor zes
// driver-items".
//
// WAT DE METING ERVAN MAAKTE
// Geteld klopt het allebei en is er niets mis. D1 tot en met D4 zijn
// herkenningsitems die elk een eigen driver meten. D5 en D6 zijn geen vijfde
// en zesde driver maar situatie-items: je kiest een handelwijze en de gekozen
// optie laadt de driver die erachter zit. D5 optie b laadt Please Others, D6
// optie b laadt Hurry Up. Er ontbreekt dus geen zesde construct.
//
// Fase 1 schreef erbij dat de blauwdruk "op meerdere plaatsen over 6 drivers
// (D1 tot D6)" spreekt. Nagelezen staat dat er niet. De blauwdruk zegt op
// regel 10 "Constructen zonder energie-anker (D1-D4 drivers)" en zet D5 en D6
// in TABEL 1 in de rij SJT-keuze, naast F4 en F5. ITEMSELECTIE punt 3 telt het
// zelf al voor: "Drivers (6 items, bron: clusters 1-5)". Zes items, vijf
// clusters, zo bedoeld. Er is hier dus niets gerepareerd, alleen vastgelegd,
// zodat niemand later opnieuw een zesde driver gaat zoeken.
//
// WAT ER WEL OPVIEL, EN WAT NIET IS AANGERAAKT
// De vijf drivers hebben een verschillend aantal bronnen en daardoor een
// verschillend bereik. Dat is gemeten en voorgelegd in het verslag; het raakt
// de doorslagregel, en de blauwdruk geeft geen grond om die te wijzigen.
// ---------------------------------------------------------------------------

const items = I.sections.find((s) => s.sectionId === "main")!.items;
const driverFam = I.families.find((f) => f.id === "Drivers")!;

describe("punt 5: zes driver-items meten vijf drivers, en dat is zo bedoeld", () => {
  it("de familie noemt vijf drivers en bevat zes items", () => {
    expect(driverFam.constructs).toEqual([
      "Be Perfect",
      "Please Others",
      "Try Hard",
      "Hurry Up",
      "Be Strong",
    ]);
    const driverItems = items.filter((i) => i.family === "Drivers");
    expect(driverItems.map((i) => i.id)).toEqual(["D1", "D2", "D3", "D4", "D5", "D6"]);
  });

  it("D1 tot en met D4 zijn herkenningsitems met elk een eigen driver", () => {
    const verwacht: Record<string, string> = {
      D1: "Be Perfect",
      D2: "Please Others",
      D3: "Try Hard",
      D4: "Hurry Up",
    };
    for (const [id, con] of Object.entries(verwacht)) {
      const it = items.find((i) => i.id === id)!;
      expect(it.itemType, `${id} hoort een herkenningsitem te zijn`).toBe("recognition");
      expect(it.construct).toBe(con);
    }
  });

  it("D5 en D6 zijn situatie-items, geen vijfde en zesde driver", () => {
    // Dit is de kern van punt 5. Wie D5 en D6 als driver-items leest, mist een
    // zesde construct. Wie ze als situatie-items leest, klopt de telling.
    for (const id of ["D5", "D6"]) {
      const it = items.find((i) => i.id === id)!;
      expect(it.itemType, `${id} hoort een situatie-item te zijn`).toBe("sjt");
      expect(I.scoringMap.sjtItems).toContain(id);
    }
  });

  it("de gekozen optie bepaalt welke driver laadt, niet het item", () => {
    // D5 optie b laadt Please Others, niet Be Strong. Dat is precies waarom
    // D5 geen eigen driver heeft.
    const a = scoreStudiekompas(I, { D5: { choice: "a" } }, null, "nl");
    expect(a.drivers.scores["Be Strong"]).toBe(2);
    expect(a.drivers.scores["Please Others"]).toBe(0);

    const b = scoreStudiekompas(I, { D5: { choice: "b" } }, null, "nl");
    expect(b.drivers.scores["Please Others"]).toBe(2);
    expect(b.drivers.scores["Be Strong"]).toBe(0);

    const zes = scoreStudiekompas(I, { D6: { choice: "b" } }, null, "nl");
    expect(zes.drivers.scores["Hurry Up"]).toBe(2);
  });

  it("de uitvoer noemt precies deze vijf drivers en geen zesde", () => {
    const r = scoreStudiekompas(I, {}, null, "nl");
    expect(Object.keys(r.drivers.scores).sort()).toEqual(
      [...driverFam.constructs].sort(),
    );
    expect(r.drivers.sorted).toHaveLength(5);
  });

  it("Be Strong heeft geen eigen herkenningsitem en wordt alleen via keuzes bereikt", () => {
    // Dit legt de scheefheid vast die in het verslag is voorgelegd. Zolang dit
    // klopt, is Be Strong niet met dezelfde soort antwoord te bereiken als de
    // andere vier.
    const metEigenItem = items.filter(
      (i) => i.itemType === "recognition" && i.construct === "Be Strong",
    );
    expect(metEigenItem).toHaveLength(0);

    const allesMaximaal = scoreStudiekompas(
      I,
      {
        D1: { recognition: 3 },
        D2: { recognition: 3 },
        D3: { recognition: 3 },
        D4: { recognition: 3 },
      },
      null,
      "nl",
    );
    expect(allesMaximaal.drivers.scores["Be Strong"]).toBe(0);
  });
});
