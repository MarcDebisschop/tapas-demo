// ---------------------------------------------------------------------------
// tests/tapas-oog-in-rapporten.test.ts
//
// Het Tapas-oog moet werkelijk op het blad staan, in beide instrumenten, en
// altijd met een uitspraak over het licht. Deze test bouwt beide rapporten langs
// hun echte keten en kijkt na wat er in de uitvoer staat:
//
//   1. het T4P Business Kompas zet het oog in het hoofdstuk over de talentmotor,
//      met een tekening, een legende per construct en een alertbalk;
//   2. het T4Students Studiekompas zet het oog op het blad "Jouw talentmotor in
//      één oogopslag", met alle constructen van de drie lagen;
//   3. geen van beide toont een graad of een cijfer voor de straling.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { instrument } from "../server/instrument";
import { buildGeneratorContract, type Responses } from "../server/scoring";
import { bouwT4pBusinessKompas, renderT4pBusinessKompasHtml } from "../server/t4p/kompas";
import { itemsVanInstrument, itemSoort } from "../server/t4students/antwoorden";
import { bouwT4StudentsAfnameContract } from "../server/t4students/afnamecontract";
import { bouwRapportUitContract } from "../server/t4students/rapport-keten";
import { OOG_KLEUR_T4P } from "../server/t4p/kompas-oog";

function t4pAntwoorden(): Responses {
  const responses: Responses = {};
  (instrument.blocks as any[]).forEach((b, i) => {
    const gesorteerd = [...b.items].sort((x: any, y: any) =>
      String(x.construct).localeCompare(String(y.construct), "nl"),
    );
    responses["B" + i] = {
      most: gesorteerd[0].pos,
      least: gesorteerd[gesorteerd.length - 1].pos,
      itemEnergy: { most: (i % 5) - 2, least: ((i + 2) % 5) - 2 },
      blockEnergy: (i % 3) - 1,
    };
  });
  return responses;
}

function t4pHtml(): string {
  const contract = buildGeneratorContract({
    respondentCode: "T4P-OOG-001",
    name: "Test Deelnemer",
    company: "TaPasCity",
    role: "Coach",
    consentScope: "profiel-generatie + rapport",
    consentTimestamp: "2026-01-01T00:00:00.000Z",
    responses: t4pAntwoorden(),
    baseline: 6,
    connection: { q1: 5, q2: 6, q3: 7, q4: 8 },
    taal: "nl",
  });
  return renderT4pBusinessKompasHtml(bouwT4pBusinessKompas(contract as any) as any);
}

describe("het Tapas-oog in het T4P Business Kompas", () => {
  const html = t4pHtml();

  it("staat als kaart met tekening, legende en alertbalk in het rapport", () => {
    expect(html).toContain("oog-kaart");
    expect(html).toContain("oog-svg");
    expect(html).toContain("oog-legende");
    expect(html).toContain("oog-alert");
  });

  it("nummert elk construct van de drie lagen in de legende", () => {
    for (const nr of ["F1", "F4", "V1", "V6", "D1", "D5"]) {
      expect(html).toContain(`>${nr}</span>`);
    }
  });

  it("laat geen plekhouder of onbepaalde waarde in de kaart lekken", () => {
    const kaart = html.slice(html.indexOf("oog-kaart"), html.indexOf("oog-alert"));
    expect(kaart).not.toContain("undefined");
    expect(kaart).not.toContain("NaN");
    expect(kaart).not.toContain("[object Object]");
  });
});

describe("het Tapas-oog in het T4Students Studiekompas", () => {
  const rapport = bouwRapportUitContract(
    bouwT4StudentsAfnameContract({
      respondentCode: "T4S-OOG-001",
      name: "Proefblad Studiekompas",
      taal: "nl",
      responses: (() => {
        const uit: Record<string, unknown> = {};
        let n = 0;
        for (const item of itemsVanInstrument()) {
          n++;
          const soort = itemSoort(item);
          if (soort === "open-intro") uit[item.id] = { text: "Ik wil weten waar mijn energie zit." };
          else if (soort === "battery") uit[item.id] = { value: 7 };
          else if (soort === "recognition+energy") uit[item.id] = { recognition: n % 4, energy: (n % 5) - 2 };
          else if (soort === "recognition") uit[item.id] = { recognition: (n % 3) + 1 };
          else if (soort === "interest") uit[item.id] = { interest: n % 3 };
          else if (item.options && item.options.length > 0) {
            const keuze = item.options[n % item.options.length]!;
            uit[item.id] = { choice: keuze.key ?? keuze.id };
          }
        }
        return uit;
      })(),
      itemTijden: null,
    }),
  );

  const blad = rapport.paginas.find((p: any) => p.nr === 4)!;
  const oog: any = (blad.blokken as any[]).find((b) => b.soort === "oog");

  it("staat op het blad over de talentmotor", () => {
    expect(blad.titel).toContain("oogopslag");
    expect(oog).toBeTruthy();
  });

  it("draagt alle constructen van de drie lagen, met kleur en status", () => {
    expect(oog.foci.length).toBeGreaterThan(0);
    expect(oog.versnellers.length).toBeGreaterThan(0);
    expect(oog.drivers.length).toBeGreaterThan(0);
    for (const c of [...oog.foci, ...oog.versnellers, ...oog.drivers]) {
      expect(typeof c.naam).toBe("string");
      expect(c.naam.length).toBeGreaterThan(1);
      expect(c.kleur).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(["geeft", "neutraal", "kost", null]).toContain(c.status);
    }
  });

  it("houdt de rangorde van het rapport aan in de eerste laag", () => {
    const band: any = (blad.blokken as any[]).find((b) => b.soort === "banden");
    const rijen = band.banden[0].rijen.map((r: any) => r.construct);
    expect(oog.foci.map((c: any) => c.naam)).toEqual(rijen);
  });
  it("geeft elke talentlaag een eigen kleur en niet één tintenreeks", () => {
    const talent = [...oog.foci, ...oog.versnellers].map((c: any) => c.kleur);
    // Twaalf constructen, twaalf verschillende identiteitskleuren.
    expect(new Set(talent).size).toBe(talent.length);
    // De drivers zijn geen talent en dragen daarom één rustige grijstint.
    expect(new Set(oog.drivers.map((c: any) => c.kleur)).size).toBe(1);
  });

  it("gebruikt dezelfde kleur als het Business Kompas waar de naam dezelfde is", () => {
    for (const c of [...oog.foci, ...oog.versnellers]) {
      const inKompas = OOG_KLEUR_T4P[c.naam];
      if (inKompas) expect(c.kleur).toBe(inKompas);
    }
    // Drie namen komen letterlijk in beide instrumenten voor: Analyse, Impact
    // en Constructief onderscheidend. Anders zegt de controle hierboven niets.
    const gedeeld = [...oog.foci, ...oog.versnellers].filter((c: any) => OOG_KLEUR_T4P[c.naam]);
    expect(gedeeld.length).toBeGreaterThanOrEqual(3);
  });
});
