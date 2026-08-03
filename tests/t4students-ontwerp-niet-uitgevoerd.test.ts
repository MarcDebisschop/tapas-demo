import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";

// ---------------------------------------------------------------------------
// Punten 1, 2 en 3 uit fase 1: constanten en tabellen die nergens gelezen
// worden.
//
// ER IS HIER MET OPZET NIETS GEREPAREERD
// De opdracht maakt onderscheid. Draagt de data het gewicht al, dan is de
// constante alleen overbodig en volstaat documenteren. Kent de blauwdruk een
// tabel wel een rol toe, dan is dat een stuk ontwerp dat niet is uitgevoerd,
// en dat hoort gemeld en voorgelegd te worden, niet stilletjes bijgebouwd.
// Alle drie de gevallen vallen in die tweede groep of zijn onschuldig. Deze
// test legt vast wat er is, zodat het niet ongemerkt verschuift, en zodat
// niemand later denkt dat deze tabellen werken.
//
// PUNT 1, sjtWeight. De blauwdruk zegt: "een gekozen SJT-optie laadt het
// bijbehorende construct met gewicht 2 (zie loads in D5/D6/F4/F5)". Nagemeten
// staat dat gewicht al in de data: zes van de acht situatie-opties dragen een
// lading met gewicht 2. De constante is dus overbodig en niet fout. Zou de
// motor haar alsnog toepassen, dan verdubbelt elke situatielading en verschuift
// elke score van elke deelnemer; dat is geen kleine ingreep.
//
// PUNT 2, rankItems. De blauwdruk kent er in punt 4 een rol aan toe: V1-V6
// worden onderling gerangschikt om de dominante versneller te bepalen. De motor
// rangschikt de opgetelde constructscores. Dat verschilt, en het verschil is
// zichtbaar voor de deelnemer, want de dominante versneller bepaalt zijn
// studiestrategie.
//
// PUNT 3, licenseRender en leastCharacteristic. De blauwdruk kent beide in punt
// 7 een rol toe. licenseRender scheidt Basis van Verdieping en die scheiding
// heet in de blauwdruk uitdrukkelijk "de deontologische scheidslijn".
// leastCharacteristic draagt de framing van de keerzijde: nuance, geen tekort.
// Geen van beide staat in code.
// ---------------------------------------------------------------------------

const sm = I.scoringMap;
const items = I.sections.find((s) => s.sectionId === "main")!.items;
const byId: Record<string, any> = Object.fromEntries(items.map((i) => [i.id, i]));

/** Alle broncode van het platform, zodat we kunnen tellen wie wat leest. */
function alleBronbestanden(): string[] {
  const wortel = path.resolve(__dirname, "..");
  const mappen = ["server", "client", "shared", "tests"];
  const uit: string[] = [];
  function loop(map: string) {
    for (const naam of readdirSync(map)) {
      if (naam === "node_modules" || naam.startsWith(".")) continue;
      const p = path.join(map, naam);
      if (statSync(p).isDirectory()) loop(p);
      else if (/\.(ts|tsx|js|mjs)$/.test(naam)) uit.push(p);
    }
  }
  for (const m of mappen) loop(path.join(wortel, m));
  return uit;
}

/**
 * Commentaar eruit, want het gaat om code die het veld werkelijk leest. Dit
 * bestand en de motor noemen deze namen juist wel, in commentaar, om uit te
 * leggen dat ze niet gebruikt worden.
 */
function zonderCommentaar(tekst: string): string {
  return tekst.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const bronnen = alleBronbestanden().map((p) => ({
  pad: p,
  code: zonderCommentaar(readFileSync(p, "utf-8")),
}));

/** Bestanden waarvan de code het veld werkelijk uitleest. */
function leestWie(naam: string): string[] {
  return bronnen
    .filter(
      (b) =>
        !b.pad.endsWith("t4students-ontwerp-niet-uitgevoerd.test.ts") &&
        !b.pad.endsWith(path.join("t4students", "instrument.ts")) &&
        b.code.includes(naam),
    )
    .map((b) => path.relative(path.resolve(__dirname, ".."), b.pad));
}

describe("punt 1: sjtWeight is afgeleid, niet toegepast", () => {
  it("de constante staat er en de motor leest hem niet", () => {
    expect(sm.constants.sjtWeight).toBe(2);
    expect(leestWie("sjtWeight")).toEqual([]);
  });

  it("het gewicht 2 zit al in de ladingen, dus de constante is overbodig", () => {
    const zonderTwee: string[] = [];
    let opties = 0;
    for (const id of sm.sjtItems) {
      for (const o of byId[id].options || []) {
        opties++;
        if (!(o.loads || []).some((l: any) => l.weight === 2)) zonderTwee.push(id + "." + o.key);
      }
    }
    expect(opties).toBe(8);
    // Zes van de acht dragen gewicht 2. De twee uitzonderingen zijn bekend en
    // benoemd: F4 optie b is punt 6, F5 optie b spreidt over twee andere
    // constructen met elk 1.
    expect(zonderTwee).toEqual(["F4.b", "F5.b"]);
  });
});

describe("punt 2: rankItems is ontwerp dat niet is uitgevoerd", () => {
  it("de tabel staat er, klopt met de blauwdruk, en wordt door niets gelezen", () => {
    expect(sm.rankItems).toEqual(["V1", "V2", "V3", "V4", "V5", "V6"]);
    expect(leestWie("rankItems")).toEqual([]);
  });

  it("de motor rangschikt sinds herstelronde 2 punt A weer zoals de blauwdruk beschrijft", () => {
    // HERSTELRONDE 2, PUNT A. Deze test heette voorheen "de motor rangschikt
    // iets anders dan de blauwdruk beschrijft" en verwachtte
    // dominanteVersneller = "Groepsondersteunend". Die verwachting was
    // gebaseerd op de RUWE SOM: Groepsondersteunend raapte via drie
    // situatiekeuzes (D5, F5, S1) evenveel ruwe punten op als Impact via zijn
    // ene item, en met een ruwe-som-rangschikking wint bij gelijke ruwe score
    // de eerst gedefinieerde. Dat was precies het gebrek dat deze testfamilie
    // aan de kaak stelde: de zes versnellers hebben een ongelijk bereik (zie
    // de test hieronder), dus een ruwe-somvergelijking is geen eerlijke
    // vergelijking.
    //
    // Sinds punt A rangschikt de motor op AANDEEL van het haalbare maximum.
    // Impact heeft hier 3 van de 3 haalbare punten (aandeel 1,0);
    // Groepsondersteunend heeft 3 van de 6 haalbare punten (aandeel 0,5).
    // Impact wint dus terecht, en de motor komt weer overeen met wat de
    // blauwdruk (rankItems, itemsgewijs) zou voorspellen. Dit is geen
    // verzwakking van de waarborg: het bereikverschil zelf (getest hieronder)
    // bestaat nog steeds en wordt nu net door de aandeelrekening opgevangen in
    // plaats van genegeerd.
    const antwoorden = {
      V1: { recognition: 0 },
      V2: { recognition: 0 },
      V3: { recognition: 0 },
      V4: { recognition: 3 },
      V5: { recognition: 0 },
      V6: { recognition: 0 },
      D5: { choice: "b" },
      F5: { choice: "a" },
      S1: { choice: "structuur" },
    };
    const r = scoreStudiekompas(I, antwoorden, null, "nl");
    expect(byId["V4"].construct).toBe("Impact");
    // Ruwe scores blijven gelijk (3 om 3): dat bewijst dat het verschil in de
    // uitkomst hieronder echt van de aandeelrekening komt, niet van de
    // herkenningssom zelf.
    expect(r.versnellers.scores["Impact"]).toBe(3);
    expect(r.versnellers.scores["Groepsondersteunend"]).toBe(3);
    expect(r.studiestrategie.dominanteVersneller).toBe("Impact");
  });

  it("de zes versnellers hebben een ongelijk bereik, en dat is de oorzaak", () => {
    const bereik: Record<string, number> = {};
    for (const con of I.families.find((f) => f.id === "Talent-versnellers")!.constructs) {
      let max = 3; // het eigen item V1-V6, herkenning 0 tot 3
      for (const it of items)
        for (const o of it.options || [])
          for (const l of o.loads || [])
            if (l.construct === con && l.weight > 0) max += l.weight;
      bereik[con] = max;
    }
    // Twee versnellers hebben alleen hun eigen item; een derde vangt er drie
    // situatieladingen bij op. Zolang dit verschil bestaat, vergelijkt de
    // rangorde ongelijke grootheden.
    expect(bereik["Impact"]).toBe(3);
    expect(bereik["Constructief onderscheidend"]).toBe(3);
    expect(bereik["Groepsondersteunend"]).toBe(6);
  });
});

describe("punt 3: licenseRender en leastCharacteristic zijn ontwerp dat niet is uitgevoerd", () => {
  it("licenseRender staat er volledig en wordt door niets gelezen", () => {
    expect(sm.licenseRender.flag).toBe("license");
    expect(sm.licenseRender.values).toEqual(["basis", "verdieping"]);
    // De blauwdruk noemt de secties 8 tot 11 de deontologische scheidslijn:
    // die horen uitsluitend in Verdieping.
    for (const sectie of ["8_richtingen", "9_keerzijde", "10_contextafstemming", "11_valkuil_checklist"]) {
      expect(sm.licenseRender.sections[sectie], `${sectie} hoort alleen in Verdieping`).toEqual([
        "verdieping",
      ]);
    }
    expect(leestWie("licenseRender")).toEqual([]);
  });

  it("de motor maakt dat onderscheid vandaag niet en levert alles", () => {
    // Zolang niets de vlag leest, komt er één uitvoer uit, ongeacht licentie.
    // Dit legt vast dat de scheiding nog niet bestaat, zodat het opvalt zodra
    // er wel op gebouwd wordt.
    const r = scoreStudiekompas(I, { V1: { recognition: 2 } }, null, "nl") as Record<string, unknown>;
    expect(r.license).toBeUndefined();
    expect(r.render).toBeUndefined();
    // De secties die alleen in Verdieping horen, worden nu altijd berekend.
    expect(r.studiegebieden).toBeDefined();
    expect(r.keerzijde).toBeDefined();
  });

  it("leastCharacteristic wordt niet gelezen, maar het losse getal wel", () => {
    expect(sm.leastCharacteristic.dimensions).toEqual([
      "Talent-foci",
      "Talent-versnellers",
      "Drivers",
    ]);
    expect(sm.leastCharacteristic.framing).toContain("nuance, geen tekort");
    expect(leestWie("leastCharacteristic\"")).toEqual([]);

    // De constante wordt wel gebruikt: de keerzijde wordt dus wel berekend,
    // alleen zonder de framing die de blauwdruk verplicht stelt.
    expect(sm.constants.leastCharacteristicCount).toBe(2);
    const r = scoreStudiekompas(I, {}, null, "nl");
    expect(r.keerzijde.minFoci).toHaveLength(2);
    expect(r.keerzijde.minVersnellers).toHaveLength(2);
    expect(r.keerzijde.minDrivers).toHaveLength(2);
  });
});
