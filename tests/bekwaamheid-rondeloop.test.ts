import { describe, expect, it } from "vitest";
import { RONDEFASEN, type Rondefase } from "../server/bekwaamheid/schema";
import {
  EINDFASEN,
  FASEN_MET_INLEVERRECHT,
  FASEN_MET_SCOREINVOER,
  TOEGESTANE_OVERGANGEN,
  bezwaarTegenOvergang,
  isRondefase,
  magOvergang,
} from "../server/bekwaamheid/rondeloop";

/**
 * De verwachting is hier UITGESCHREVEN en niet afgeleid uit
 * TOEGESTANE_OVERGANGEN. Zou de test de tabel gebruiken om de tabel te toetsen,
 * dan zou elke wijziging in de tabel zichzelf goedkeuren en meet de test niets.
 * Deze lijst is met de hand opgesteld uit de loop in het draaiboek; elke regel
 * die hier niet staat, is verboden.
 */
const VERWACHT: Record<Rondefase, Rondefase[]> = {
  voorbereiding: ["open", "gestaakt"],
  open: ["ingeleverd", "gestaakt"],
  ingeleverd: ["in_beoordeling", "open", "gestaakt"],
  in_beoordeling: ["beslissing_voorstel", "overleg", "gestaakt"],
  beslissing_voorstel: ["overleg", "beslist", "gestaakt"],
  overleg: ["beslist", "gestaakt"],
  beslist: ["gedebrieft"],
  gedebrieft: ["afgesloten", "bezwaar"],
  afgesloten: ["bezwaar"],
  bezwaar: ["afgesloten", "in_beoordeling"],
  gestaakt: [],
};

describe("de loop van een ronde, uitputtend", () => {
  it("kent alle elf fasen uit het schema", () => {
    expect(Object.keys(TOEGESTANE_OVERGANGEN).sort()).toEqual([...RONDEFASEN].sort());
  });

  it("beslist voor alle 121 paren precies zoals de uitgeschreven loop", () => {
    let getoetst = 0;
    for (const van of RONDEFASEN) {
      for (const naar of RONDEFASEN) {
        getoetst += 1;
        const magHet = VERWACHT[van].includes(naar);
        expect(magOvergang(van, naar), `${van} -> ${naar}`).toBe(magHet);
      }
    }
    expect(getoetst).toBe(RONDEFASEN.length * RONDEFASEN.length);
    expect(getoetst).toBe(121);
  });

  it("staat geen enkele fase toe naar zichzelf te gaan", () => {
    for (const fase of RONDEFASEN) {
      expect(magOvergang(fase, fase), `${fase} -> ${fase}`).toBe(false);
    }
  });

  it("laat maar één stap terug toe in de hele loop: ingeleverd naar open", () => {
    const volgorde = RONDEFASEN.indexOf.bind(RONDEFASEN);
    const stappenTerug: string[] = [];
    for (const van of RONDEFASEN) {
      for (const naar of TOEGESTANE_OVERGANGEN[van]) {
        // 'bezwaar' en 'gestaakt' staan achteraan in de lijst maar zijn
        // zijsporen en geen volgordepositie; ze tellen hier niet mee.
        if (van === "bezwaar" || naar === "bezwaar" || naar === "gestaakt") continue;
        if (volgorde(naar) < volgorde(van)) stappenTerug.push(`${van} -> ${naar}`);
      }
    }
    expect(stappenTerug).toEqual(["ingeleverd -> open"]);
  });

  it("maakt staken onmogelijk zodra er een beslissing ligt", () => {
    for (const fase of ["beslist", "gedebrieft", "afgesloten", "bezwaar"] as const) {
      expect(magOvergang(fase, "gestaakt"), `${fase} -> gestaakt`).toBe(false);
    }
    for (const fase of [
      "voorbereiding",
      "open",
      "ingeleverd",
      "in_beoordeling",
      "beslissing_voorstel",
      "overleg",
    ] as const) {
      expect(magOvergang(fase, "gestaakt"), `${fase} -> gestaakt`).toBe(true);
    }
  });

  it("houdt afgesloten bereikbaar voor bezwaar, want de termijn loopt door", () => {
    expect(magOvergang("afgesloten", "bezwaar")).toBe(true);
    expect(EINDFASEN).toEqual(["gestaakt"]);
    expect(TOEGESTANE_OVERGANGEN.gestaakt).toHaveLength(0);
  });

  it("laat een gegrond bezwaar terug naar de beoordeling gaan", () => {
    expect(magOvergang("bezwaar", "in_beoordeling")).toBe(true);
  });
});

describe("de uitleg bij een geweigerde overgang", () => {
  it("zwijgt wanneer de overgang mag", () => {
    expect(bezwaarTegenOvergang("open", "ingeleverd")).toBeNull();
  });

  it("zegt het apart wanneer de ronde al in die fase staat", () => {
    expect(bezwaarTegenOvergang("open", "open")).toContain("staat al in fase");
  });

  it("zegt bij een eindfase dat er niets meer volgt", () => {
    expect(bezwaarTegenOvergang("gestaakt", "open")).toContain("eindfase");
  });

  it("noemt de fasen die wél mogen", () => {
    const tekst = bezwaarTegenOvergang("voorbereiding", "beslist");
    expect(tekst).toContain("'open'");
    expect(tekst).toContain("'gestaakt'");
  });
});

describe("de hulplijsten", () => {
  it("geeft inleverrecht alleen in een open ronde", () => {
    expect(FASEN_MET_INLEVERRECHT).toEqual(["open"]);
  });

  it("laat scores invoeren in de drie beoordelingsfasen en nergens anders", () => {
    expect([...FASEN_MET_SCOREINVOER].sort()).toEqual([
      "beslissing_voorstel",
      "in_beoordeling",
      "overleg",
    ]);
    for (const fase of RONDEFASEN) {
      const mag = FASEN_MET_SCOREINVOER.includes(fase);
      if (["in_beoordeling", "beslissing_voorstel", "overleg"].includes(fase)) {
        expect(mag, fase).toBe(true);
      } else {
        expect(mag, fase).toBe(false);
      }
    }
  });

  it("herkent een fase alleen wanneer ze in het schema staat", () => {
    expect(isRondefase("open")).toBe(true);
    expect(isRondefase("OPEN")).toBe(false);
    expect(isRondefase("afgerond")).toBe(false);
    expect(isRondefase(null)).toBe(false);
    expect(isRondefase(3)).toBe(false);
  });
});
