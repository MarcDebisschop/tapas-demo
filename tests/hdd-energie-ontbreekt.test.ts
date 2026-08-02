// ---------------------------------------------------------------------------
// tests/hdd-energie-ontbreekt.test.ts
//
// Vastzetten dat HDD geen energiecijfer verzint. Een 2MinScan-intake levert
// geen energie op de schaal 0 tot 10; dat hoort een zichtbaar ontbrekend
// gegeven te zijn en geen stille terugval op een middenwaarde of, zoals
// vroeger, een nul die als slechte meting werd gelezen.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import {
  ENERGIE_INSTRUMENTEN,
  bouwFase2Aggregaat,
  ledenEnergie,
  NIET_GEMETEN_BAND,
  type BoardMemberInput,
} from "../server/hdd/aggregatie";
import { bouwRapport } from "../server/hdd/rapport";
import { ENERGIE_TERUGVAL, energieNaarTienschaal } from "../shared/energie-schaal";

function lid(id: number, energy?: BoardMemberInput["energy"]): BoardMemberInput {
  return {
    id,
    naam: `Lid ${id}`,
    teamscan: { vertrouwen: 4, conflict: 4, betrokkenheid: 4, verantwoordelijkheid: 4, resultaten: 4 },
    energy,
    talent: {
      talentFoci: ["Strategy", "Operational"],
      versnellers: ["Analysis"],
      drivers: ["Be Strong"],
      driverRisico: "laag",
      stratumIndicatie: 4,
    },
  };
}

const bord = (energy?: BoardMemberInput["energy"]) =>
  bouwFase2Aggregaat({ context: "ma", leden: [1, 2, 3, 4].map((i) => lid(i, energy)) });

describe("de 2MinScan levert geen energiewaarde", () => {
  it("staat niet in de lijst van instrumenten die naar energie vragen", () => {
    expect(ENERGIE_INSTRUMENTEN as readonly string[]).not.toContain("2minscan");
    expect(ENERGIE_INSTRUMENTEN as readonly string[]).not.toContain("twominscan");
  });

  it("geeft geen energie voor een lid met alleen een 2MinScan-intake", () => {
    // Een 2MinScan-intake levert hooguit een fase, geen getal op 0 tot 10.
    expect(ledenEnergie(lid(1, { fase: 0 }))).toBeNull();
    expect(ledenEnergie(lid(1, { bron: "2minscan", fase: 0 }))).toBeNull();
    // Ook niet als er ergens toch een getal opduikt zonder herkomst.
    expect(ledenEnergie(lid(1, { energie: 9 }))).toBeNull();
    expect(ledenEnergie(lid(1, { bron: "2minscan", energie: 9 }))).toBeNull();
    expect(ledenEnergie(lid(1, undefined))).toBeNull();
  });

  it("gebruikt wel energie van een instrument dat er echt naar vraagt", () => {
    expect(ledenEnergie(lid(1, { bron: "t4p-business", energie: 7 }))).toBe(7);
    expect(ledenEnergie(lid(1, { bron: "t4sports", energie: 7 }))).toBe(7);
  });

  it("zet ruwe item-energie om met de gedeelde omzetting uit correctie 2", () => {
    for (const ruw of [-2, -1, -0.5, 0, 0.333, 1, 2]) {
      expect(ledenEnergie(lid(1, { bron: "t4p-business", itemEnergie: ruw }))).toBe(
        energieNaarTienschaal(ruw),
      );
    }
  });
});

describe("de aggregatie behandelt ontbrekende energie als ontbrekend", () => {
  it("markeert de dimensie als niet beschikbaar bij een 2MinScan-intake", () => {
    const agg = bord({ fase: 0 });
    expect(agg.d2Energy.beschikbaar).toBe(false);
    expect(agg.d2Energy.band).toBe(NIET_GEMETEN_BAND);
    expect(agg.d2Energy.detail.teamMean).toBeNull();
    expect(agg.d2Energy.detail.n).toBe(0);
  });

  it("vult geen middenwaarde in", () => {
    const agg = bord({ fase: 0 });
    expect(agg.d2Energy.detail.teamMean).not.toBe(ENERGIE_TERUGVAL);
    expect(agg.d2Energy.score100).not.toBe(ENERGIE_TERUGVAL * 10);
  });

  it("laat de ontbrekende dimensie niet als nulscore in het teamcijfer wegen", () => {
    const zonder = bord({ fase: 0 });
    const met = bord({ bron: "t4p-business", energie: 7 });
    // Met een gemeten energie van 7 op 10 (70 op 100) ligt het cijfer hoger dan
    // zonder. Maar zonder mag het cijfer niet instorten alsof er 0 gemeten is:
    // vroeger zakte het van 66 naar 49 en sloeg het oordeel om.
    expect(zonder.index).toBeGreaterThan(met.index - 10);
    expect(zonder.index).toBeGreaterThan(60);
  });

  it("benoemt in gewone taal welk onderdeel ontbreekt", () => {
    const agg = bord({ fase: 0 });
    expect(agg.indexBasis.volledig).toBe(false);
    expect(agg.indexBasis.ontbrekendeDimensies).toEqual(["Energy Sustainability"]);
    expect(agg.indexBasis.gebruikteDimensies).not.toContain("Energy Sustainability");
    expect(agg.indexBasis.toelichting).toMatch(/minder gegevens/);
  });

  it("meldt niets ontbrekends wanneer alles gemeten is", () => {
    const agg = bord({ bron: "t4p-business", energie: 7 });
    expect(agg.d2Energy.beschikbaar).toBe(true);
    expect(agg.indexBasis.volledig).toBe(true);
    expect(agg.indexBasis.ontbrekendeDimensies).toEqual([]);
  });

  it("telt per lid hoeveel energiemetingen ontbreken", () => {
    const agg = bouwFase2Aggregaat({
      context: "ma",
      leden: [
        lid(1, { bron: "t4p-business", energie: 8 }),
        lid(2, { bron: "t4p-business", energie: 8 }),
        lid(3, { fase: 0 }),
        lid(4, undefined),
      ],
    });
    expect(agg.d2Energy.beschikbaar).toBe(true);
    expect(agg.d2Energy.detail.n).toBe(2);
    expect(agg.d2Energy.detail.ontbrekend).toBe(2);
  });
});

describe("het rapport maakt de ontbrekende energie zichtbaar", () => {
  const rapport = (energy?: BoardMemberInput["energy"]) => {
    const leden = [1, 2, 3, 4].map((i) => lid(i, energy));
    return bouwRapport({
      audience: "investor",
      boardLabel: "Demo board",
      context: "ma",
      agg: bouwFase2Aggregaat({ context: "ma", leden }),
      leden,
    });
  };

  const tekstVan = (m: ReturnType<typeof rapport>, id: string) => {
    const s = m.secties.find((x) => x.id === id)!;
    return [...(s.body ?? []), ...(s.bullets ?? [])].join(" ");
  };

  it("zegt met zoveel woorden dat er niets gemeten is", () => {
    const t = tekstVan(rapport({ fase: 0 }), "energy");
    expect(t).toMatch(/No energy was measured/);
    expect(t).toMatch(/missing data, not a low score/);
    expect(t).toMatch(/2MINSCAN/);
  });

  it("zegt dat het teamcijfer daardoor op minder gegevens rust", () => {
    const t = tekstVan(rapport({ fase: 0 }), "verdict");
    expect(t).toMatch(/rests on fewer data/);
    expect(t).toMatch(/missing measurement stays\s+missing/);
  });

  it("toont geen energiecijfer in de dimensietabel wanneer er niets gemeten is", () => {
    const m = rapport({ fase: 0 });
    const rij = m.secties
      .find((s) => s.id === "verdict")!
      .table!.rows.find((r) => r[0] === "Energy Sustainability")!;
    expect(rij[2]).toBe("not measured");
    expect(rij[3]).toBe(NIET_GEMETEN_BAND);
  });

  it("toont per lid dat de energie niet gemeten is", () => {
    const m = rapport({ fase: 0 });
    const kaart = m.secties.find((s) => s.id === "scorecards")!.cards![0];
    expect(kaart.lines.join(" ")).toMatch(/Energy: not measured/);
  });

  it("zwijgt over ontbrekende gegevens wanneer alles gemeten is", () => {
    const t = tekstVan(rapport({ bron: "t4p-business", energie: 8 }), "verdict");
    expect(t).not.toMatch(/rests on fewer data/);
  });

  it("laat de bestaande prototype-waarschuwingen ongemoeid", () => {
    const m = rapport({ bron: "t4p-business", energie: 8 });
    const alles = JSON.stringify(m);
    expect(alles).toMatch(/developer convention, not a calibration on a norm group/);
    expect(alles).toMatch(/never used to rank people/);
  });
});
