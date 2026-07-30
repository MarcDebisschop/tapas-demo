// ---------------------------------------------------------------------------
// tests/sessie-regeneratie.test.ts - Auditbevinding H-1 (hoog).
//
// Wat deze tests bewijzen:
//   1. zetSessieIdentiteit() vernieuwt ALTIJD eerst het sessie-id, zet daarna de
//      identiteit en bewaart pas dan. Die volgorde is de kern van de bescherming
//      tegen session fixation: een vooraf opgedrongen sessie-id kan na de login
//      niet meer gebruikt worden.
//   2. Fouten in regenerate of save worden doorgegeven, zodat een route geen
//      geslaagde login meldt terwijl de sessie niet bewaard is.
//   3. wisSessieIdentiteit() wist de identiteit en vervangt het sessie-id.
//   4. Elk inlogpad in de codebase (admin, coach, organisatie) gebruikt de
//      helper, en geen enkel inlogpad zet nog rechtstreeks een identiteitsveld
//      op de sessie zonder regeneratie. Regressievangnet voor nieuwe logins.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { zetSessieIdentiteit, wisSessieIdentiteit } from "../server/sessie-identiteit";

/** Nabootsing van een express-session sessie die de volgorde vastlegt. */
function nepVerzoek(opties: { regenerateFout?: any; saveFout?: any } = {}) {
  const volgorde: string[] = [];
  const sessie: any = {
    adminId: 999, // waarde uit een eerdere, opgedrongen sessie
    regenerate(cb: (f?: any) => void) {
      volgorde.push("regenerate");
      // Een echte regenerate levert een verse, lege sessie op.
      for (const k of Object.keys(sessie)) {
        if (!["regenerate", "save", "destroy"].includes(k)) delete sessie[k];
      }
      cb(opties.regenerateFout);
    },
    save(cb: (f?: any) => void) {
      volgorde.push("save");
      cb(opties.saveFout);
    },
  };
  return { req: { session: sessie } as any, sessie, volgorde };
}

describe("H-1: zetSessieIdentiteit vernieuwt het sessie-id voor de login", () => {
  it("regenereert eerst, zet dan de identiteit en bewaart pas daarna", async () => {
    const { req, sessie, volgorde } = nepVerzoek();
    await zetSessieIdentiteit(req, { adminId: 42 });
    expect(volgorde).toEqual(["regenerate", "save"]);
    expect(sessie.adminId).toBe(42);
  });

  it("laat geen enkel veld van de oude sessie overleven", async () => {
    const { req, sessie } = nepVerzoek();
    sessie.organisatieId = 5;
    await zetSessieIdentiteit(req, { coachId: 3 });
    expect(sessie.organisatieId).toBeUndefined();
    expect(sessie.coachId).toBe(3);
  });

  it("verwerpt wanneer regenerate faalt, en zet de identiteit dan niet", async () => {
    const { req, sessie } = nepVerzoek({ regenerateFout: new Error("stuk") });
    await expect(zetSessieIdentiteit(req, { adminId: 42 })).rejects.toThrow("stuk");
    expect(sessie.adminId).toBeUndefined();
  });

  it("verwerpt wanneer bewaren faalt", async () => {
    const { req } = nepVerzoek({ saveFout: new Error("schijf vol") });
    await expect(zetSessieIdentiteit(req, { adminId: 42 })).rejects.toThrow("schijf vol");
  });

  it("verwerpt wanneer er geen sessie op het verzoek staat", async () => {
    await expect(zetSessieIdentiteit({} as any, { adminId: 1 })).rejects.toThrow(/sessie/i);
  });
});

describe("H-1: uitloggen vervangt het sessie-id", () => {
  it("wist de identiteit en regenereert", async () => {
    const { req, sessie, volgorde } = nepVerzoek();
    sessie.adminId = 42;
    await wisSessieIdentiteit(req, ["adminId"]);
    expect(volgorde).toEqual(["regenerate", "save"]);
    expect(sessie.adminId).toBeUndefined();
  });
});

describe("H-1: elk inlogpad gebruikt de helper", () => {
  const bestanden = [
    "../server/routes/admin.ts",
    "../server/routes-stm.ts",
    "../server/routes/organisatie-auth.ts",
  ];
  const bronnen = new Map(
    bestanden.map((p) => [p, readFileSync(resolve(__dirname, p), "utf8")] as const),
  );

  for (const [pad, bron] of bronnen) {
    it(`${pad.split("/").pop()} regenereert de sessie bij het inloggen`, () => {
      expect(bron).toMatch(/zetSessieIdentiteit\(/);
      expect(bron).toMatch(/from "\.{1,2}\/sessie-identiteit"/);
    });
  }

  it("dekt de drie identiteitsvelden adminId, coachId en organisatieId", () => {
    const alles = [...bronnen.values()].join("\n");
    for (const veld of ["adminId", "coachId", "organisatieId"]) {
      expect(alles).toMatch(new RegExp(`zetSessieIdentiteit\\(req, \\{ ${veld}:`));
    }
  });

  it("zet nergens nog rechtstreeks een identiteitsveld met een waarde op de sessie", () => {
    // Toegestaan is enkel het wissen (= undefined). Elke andere directe
    // toekenning zou een login zonder regeneratie kunnen zijn.
    for (const [pad, bron] of bronnen) {
      const treffers = [
        ...bron.matchAll(
          /\(req\.session as any\)\.(adminId|coachId|organisatieId)\s*=\s*([^;]+);/g,
        ),
      ].filter((m) => m[2].trim() !== "undefined");
      expect(treffers.map((m) => m[0]), `directe sessietoekenning in ${pad}`).toEqual([]);
    }
  });
});
