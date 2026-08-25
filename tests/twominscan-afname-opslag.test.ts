// 2MINSCAN — bewaarde afnames voor het teamwiel.
//
// Deze test waakt over twee dingen: dat een bewaarde afname terugkomt zoals ze
// bewaard is, en dat er niet méér bewaard wordt dan een teamwiel nodig heeft.
// De databank is een tijdelijk bestand; de echte data.db wordt niet geraakt.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const map = mkdtempSync(path.join(tmpdir(), "twominscan-opslag-"));
process.env.TAPAS_DB_PATH = path.join(map, "test.db");

let opslag: typeof import("../server/twominscan/afname-opslag");
let sqlite: any;

beforeAll(async () => {
  opslag = await import("../server/twominscan/afname-opslag");
  sqlite = (await import("../server/storage")).sqlite;
});

afterAll(() => {
  rmSync(map, { recursive: true, force: true });
});

describe("bewaarde 2MINSCAN-afnames", () => {
  it("geeft een bewaarde afname onveranderd terug", () => {
    const bewaard = opslag.bewaarAfname({
      naam: "Ilse Verhoeven",
      wielpositie: "24-44",
      organisatie: "Newco",
      rol: "algemeen directeur",
      egCode: "TbEEN-a",
      taal: "nl",
      datum: "25 augustus 2026",
    });
    expect(bewaard.id).toBeGreaterThan(0);

    const lijst = opslag.leesAfnames("Newco");
    const terug = lijst.find((a) => a.id === bewaard.id);
    expect(terug).toBeDefined();
    expect(terug!.naam).toBe("Ilse Verhoeven");
    expect(terug!.wielpositie).toBe("24-44");
    expect(terug!.rol).toBe("algemeen directeur");
    expect(terug!.egCode).toBe("TbEEN-a");
    expect(terug!.organisatie).toBe("Newco");
  });

  it("houdt de organisaties met hun aantal bij en filtert erop", () => {
    opslag.bewaarAfname({ naam: "Bram De Cock", wielpositie: "34-54", organisatie: "Newco" });
    opslag.bewaarAfname({ naam: "Iemand Anders", wielpositie: "31-51", organisatie: "Andere bv" });

    const organisaties = opslag.leesOrganisaties();
    const newco = organisaties.find((o) => o.organisatie === "Newco");
    expect(newco?.aantal).toBe(2);

    const alleenNewco = opslag.leesAfnames("Newco");
    expect(alleenNewco.every((a) => a.organisatie === "Newco")).toBe(true);
    expect(alleenNewco.length).toBe(2);
    expect(opslag.leesAfnames().length).toBe(3);
  });

  it("verwijdert een afname op vraag", () => {
    const bewaard = opslag.bewaarAfname({ naam: "Tijdelijk", wielpositie: "22-42" });
    expect(opslag.verwijderAfname(bewaard.id)).toBe(true);
    expect(opslag.verwijderAfname(bewaard.id)).toBe(false);
    expect(opslag.leesAfnames().some((a) => a.id === bewaard.id)).toBe(false);
  });

  it("bewaart geen antwoorden, scores of foto's", () => {
    const kolommen = (sqlite.prepare("PRAGMA table_info(twominscan_afnames)").all() as any[]).map(
      (k) => String(k.name),
    );
    expect(kolommen.sort()).toEqual(
      [
        "bewaard_op",
        "datum",
        "eg_code",
        "id",
        "naam",
        "organisatie",
        "rol",
        "taal",
        "wielpositie",
      ].sort(),
    );
    for (const verboden of ["antwoorden", "scores", "foto", "portret", "main_responses"]) {
      expect(kolommen).not.toContain(verboden);
    }
  });
});
