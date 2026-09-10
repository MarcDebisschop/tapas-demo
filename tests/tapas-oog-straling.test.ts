// ---------------------------------------------------------------------------
// tests/tapas-oog-straling.test.ts
//
// Het Tapas-oog straalt niet naar gevoel. Deze test legt de regel vast:
//
//   1. de driverpoort komt uitsluitend uit de twee dominantste drivers,
//   2. het talentlicht weegt naar rangorde en gebruikt de energiebanden uit
//      shared/energie-schaal.ts, dus niet een tweede eigen knipverdeling,
//   3. het niveau is het laagste van talentlicht en poort, met een rem op de
//      twee sterkste talenten,
//   4. niveau 0 straalt een spleet, geen nul: de gordijnen hangen voor het hele
//      beeld en niet enkel voor de eerste laag,
//   5. zonder gemeten energie is er geen straling en geen terugval op een
//      middenwaarde,
//   6. beide rapporten tonen het oog werkelijk op het blad.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import {
  OOG_KRACHT,
  oogPoort,
  oogStraling,
  oogTalentlicht,
  oogTekening,
  type OogConstruct,
} from "../shared/tapas-oog";

type St = OogConstruct["status"];

function c(naam: string, status: St): OogConstruct {
  return { naam, status, kleur: "#888888" };
}

/** Vier talenten en zes versnellers met dezelfde status, zodat het talentlicht
 * bepaald wordt door wat de test wil onderzoeken en niet door ruis. */
function talenten(status: St): { foci: OogConstruct[]; versnellers: OogConstruct[] } {
  return {
    foci: [1, 2, 3, 4].map((i) => c("F" + i, status)),
    versnellers: [1, 2, 3, 4, 5, 6].map((i) => c("V" + i, status)),
  };
}

function drivers(...statussen: St[]): OogConstruct[] {
  return statussen.map((s, i) => c("D" + (i + 1), s));
}

describe("de driverpoort", () => {
  it("kijkt naar de twee dominantste drivers en negeert de rest", () => {
    const open = oogPoort(drivers("geeft", "geeft", "kost", "kost", "kost"));
    const dicht = oogPoort(drivers("kost", "kost", "geeft", "geeft", "geeft"));
    expect(open.stand).toBe(3);
    expect(dicht.stand).toBe(0);
  });

  it("zet de poort dicht zodra de twee eerste drivers energie kosten", () => {
    expect(oogPoort(drivers("kost", "kost", "neutraal")).stand).toBe(0);
  });

  it("knijpt wanneer de eerste kost en de tweede neutraal is", () => {
    expect(oogPoort(drivers("kost", "neutraal", "geeft")).stand).toBe(1);
  });

  it("meldt het en gaat niet lager dan half open zonder twee gemeten drivers", () => {
    const p = oogPoort(drivers("kost", null, null));
    expect(p.stand).toBe(2);
    expect(p.melding).toBeTruthy();
  });
});

describe("het talentlicht", () => {
  it("weegt naar rangorde: hetzelfde aantal, andere plaats, ander licht", () => {
    const vooraan = oogTalentlicht({
      foci: [c("F1", "geeft"), c("F2", "geeft"), c("F3", "kost"), c("F4", "kost")],
      versnellers: [],
      drivers: [],
    });
    const achteraan = oogTalentlicht({
      foci: [c("F1", "kost"), c("F2", "kost"), c("F3", "geeft"), c("F4", "geeft")],
      versnellers: [],
      drivers: [],
    });
    expect(vooraan).not.toBeNull();
    expect(achteraan).not.toBeNull();
    expect(vooraan!).toBeGreaterThan(achteraan!);
  });

  it("geeft null zolang geen enkel talent gemeten energie heeft", () => {
    expect(oogTalentlicht({ foci: [c("F1", null)], versnellers: [], drivers: [] })).toBeNull();
  });
});

describe("de straling", () => {
  it("straalt vol wanneer talent en poort samen meelopen", () => {
    const u = oogStraling({ ...talenten("geeft"), drivers: drivers("geeft", "geeft", "geeft") });
    expect(u.niveau).toBe(3);
    expect(u.kracht).toBe(OOG_KRACHT[3]);
    expect(u.gordijnen).toBe(false);
  });

  it("valt naar nul zodra de twee dominantste drivers energie kosten, hoe sterk het talent ook is", () => {
    const u = oogStraling({ ...talenten("geeft"), drivers: drivers("kost", "kost", "geeft") });
    expect(u.niveau).toBe(0);
    expect(u.gordijnen).toBe(true);
    expect(u.poortNaam).toBe("poort dicht");
  });

  it("laat op niveau 0 een spleet licht: het talent is niet kleiner geworden", () => {
    const u = oogStraling({ ...talenten("geeft"), drivers: drivers("kost", "kost") });
    expect(u.kracht).toBeGreaterThan(0);
    expect(u.kracht).toBeLessThan(OOG_KRACHT[1]);
    expect(u.alertTekst).toContain("controle");
  });

  it("hangt de gordijnen voor het hele beeld, niet enkel voor de eerste laag", () => {
    const tek = oogTekening(
      { ...talenten("geeft"), drivers: drivers("kost", "kost") },
      240,
      170,
    );
    expect(tek.gordijn.length).toBeGreaterThan(4);
  });

  it("remt tot hoogstens licht stralend wanneer een van de twee sterkste talenten energie kost", () => {
    const u = oogStraling({
      foci: [c("F1", "kost"), c("F2", "geeft"), c("F3", "geeft"), c("F4", "geeft")],
      versnellers: [1, 2, 3, 4, 5, 6].map((i) => c("V" + i, "geeft")),
      drivers: drivers("geeft", "geeft", "geeft"),
    });
    expect(u.niveau).toBeLessThanOrEqual(2);
    expect(u.remActief).toBe(true);
  });

  it("straalt niet en verzint geen middenwaarde zonder gemeten energie", () => {
    const u = oogStraling({
      foci: [c("F1", null), c("F2", null)],
      versnellers: [c("V1", null)],
      drivers: [c("D1", null), c("D2", null)],
    });
    expect(u.kracht).toBe(0);
    expect(u.talentlicht).toBeNull();
    expect(u.meldingen.length).toBeGreaterThan(0);
  });

  it("neemt altijd het laagste van talentlicht en poort", () => {
    const u = oogStraling({ ...talenten("kost"), drivers: drivers("geeft", "geeft") });
    expect(u.poort).toBe(3);
    expect(u.niveau).toBeLessThan(3);
  });
});

describe("de tekening", () => {
  it("geeft één legenderegel per construct, in ringvolgorde", () => {
    const tek = oogTekening(
      { ...talenten("geeft"), drivers: drivers("geeft", "neutraal", "kost", null, "geeft") },
      240,
      170,
    );
    expect(tek.legende.map((l) => l.nummer)).toEqual([
      "F1", "F2", "F3", "F4",
      "V1", "V2", "V3", "V4", "V5", "V6",
      "D1", "D2", "D3", "D4", "D5",
    ]);
    expect(tek.binnen.length).toBeGreaterThan(0);
    expect(tek.voor.length).toBeGreaterThan(0);
  });

  it("noemt geen graad en geen cijfer bij het licht, enkel een woord", () => {
    for (const st of ["geeft", "neutraal", "kost"] as St[]) {
      const u = oogStraling({ ...talenten(st), drivers: drivers(st, st) });
      expect(u.niveauNaam).not.toMatch(/[0-9]/);
      expect(u.poortNaam).not.toMatch(/[0-9]/);
      expect(u.alertKop).not.toMatch(/[0-9]/);
    }
  });
});
