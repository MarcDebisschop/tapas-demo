/**
 * tests/traject-geen-vragenlijst.test.ts
 *
 * Een traject is geen vragenlijst, en een ingevuld Kompas gaat niet verloren.
 * ---------------------------------------------------------------------------
 * Twee dingen liepen mis en beide staan hier vast.
 *
 * 1. Human Due Diligence stond in Bulk-import tussen de instrumenten. Een
 *    bulkverzending maakte dan één afnamerij met instrumentId "hdd" en één link
 *    naar /deelnemer/TOKEN. Achter die link zat de standaardvragenlijst, dus de
 *    deelnemer vulde het TaPas Business Kompas in en de Teamscan en de 2MINSCAN
 *    volgden nooit: alleen het trajectscherm maakt die twee uitnodigingen aan.
 *
 * 2. De rijen die zo ontstonden dragen instrumentId "hdd" en bevatten echte
 *    Kompas-antwoorden. Het traject herkende ze niet en maakte in fase 2 een
 *    tweede, lege uitnodiging aan. Het lid moest zijn Kompas dan opnieuw
 *    invullen.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TEMPLATES, getTemplate, alleTemplates } from "../server/bulk-import/templates";
import {
  isTrajectInstrument,
  trajectWeigering,
  MELDING_TRAJECT_NIET_INVULBAAR,
  CODE_TRAJECT_NIET_INVULBAAR,
} from "../server/traject-poort";
import { zoekBestaandeAfname, T4P_INSTRUMENT, TWOMINSCAN_INSTRUMENT } from "../server/hdd/uitsturen";

describe("een traject is geen vragenlijst", () => {
  it("Bulk-import biedt Human Due Diligence niet meer aan", () => {
    expect(TEMPLATES.hdd).toBeUndefined();
    expect(getTemplate("hdd")).toBeUndefined();
    expect(alleTemplates().map((t) => t.instrumentId)).not.toContain("hdd");
  });

  it("herkent een traject en laat de gewone instrumenten door", () => {
    expect(isTrajectInstrument("hdd")).toBe(true);
    expect(isTrajectInstrument("t4p-business-kompas")).toBe(false);
    expect(isTrajectInstrument("twominscan")).toBe(false);
    expect(isTrajectInstrument(null)).toBe(false);
    expect(isTrajectInstrument("bestaat-niet")).toBe(false);
  });

  it("weigert met 400, een code en een melding die naar het trajectscherm wijst", () => {
    const weigering = trajectWeigering();
    expect(weigering.status).toBe(400);
    expect(weigering.lichaam.code).toBe(CODE_TRAJECT_NIET_INVULBAAR);
    expect(weigering.lichaam.error).toBe(MELDING_TRAJECT_NIET_INVULBAAR);
    expect(MELDING_TRAJECT_NIET_INVULBAAR).toContain("trajectscherm");
    expect(MELDING_TRAJECT_NIET_INVULBAAR).toContain("Teamscan");
    expect(MELDING_TRAJECT_NIET_INVULBAAR).toContain("2MINSCAN");
  });

  it("gebruikt nergens een lang of een half lang streepje", () => {
    for (const tekst of [MELDING_TRAJECT_NIET_INVULBAAR]) {
      expect(tekst.includes(String.fromCharCode(0x2014))).toBe(false);
      expect(tekst.includes(String.fromCharCode(0x2013))).toBe(false);
    }
  });
});

describe("een ingevuld Kompas gaat niet verloren", () => {
  const kompasRij = {
    id: 41,
    name: "Dirk Vermeiren",
    company: "Vanderlinde Group",
    deelnemerEmail: "dirk@vanderlinde.be",
    instrumentId: "hdd",
    inviteToken: "OUD-TOKEN",
  };

  it("neemt een oude traject-rij over als Kompas van dit lid", () => {
    const treffer = zoekBestaandeAfname(
      [kompasRij],
      { naam: "Dirk Vermeiren", email: "dirk@vanderlinde.be" },
      T4P_INSTRUMENT,
      "Vanderlinde Group",
    );
    expect(treffer?.inviteToken).toBe("OUD-TOKEN");
    expect(treffer?.instrumentId).toBe("hdd");
  });

  it("volgt het e-mailadres, ook wanneer het bedrijfslabel afwijkt", () => {
    const treffer = zoekBestaandeAfname(
      [kompasRij],
      { naam: "D. Vermeiren", email: "DIRK@vanderlinde.be" },
      T4P_INSTRUMENT,
      "Vanderlinde Group NV",
    );
    expect(treffer?.inviteToken).toBe("OUD-TOKEN");
  });

  it("valt terug op de naam binnen hetzelfde bedrijfslabel wanneer er geen adres is", () => {
    const treffer = zoekBestaandeAfname(
      [{ ...kompasRij, deelnemerEmail: null }],
      { naam: "dirk  vermeiren", email: null },
      T4P_INSTRUMENT,
      "vanderlinde group",
    );
    expect(treffer?.inviteToken).toBe("OUD-TOKEN");
  });

  it("neemt de jongste rij wanneer er meer dan één staat", () => {
    const treffer = zoekBestaandeAfname(
      [kompasRij, { ...kompasRij, id: 77, instrumentId: T4P_INSTRUMENT, inviteToken: "NIEUW" }],
      { naam: "Dirk Vermeiren", email: "dirk@vanderlinde.be" },
      T4P_INSTRUMENT,
      "Vanderlinde Group",
    );
    expect(treffer?.inviteToken).toBe("NIEUW");
  });

  it("laat een rij zonder code liggen", () => {
    const treffer = zoekBestaandeAfname(
      [{ ...kompasRij, inviteToken: null }],
      { naam: "Dirk Vermeiren", email: "dirk@vanderlinde.be" },
      T4P_INSTRUMENT,
      "Vanderlinde Group",
    );
    expect(treffer).toBeUndefined();
  });

  it("rekent een traject-rij niet mee voor de 2MINSCAN", () => {
    const treffer = zoekBestaandeAfname(
      [kompasRij],
      { naam: "Dirk Vermeiren", email: "dirk@vanderlinde.be" },
      TWOMINSCAN_INSTRUMENT,
      "Vanderlinde Group",
    );
    expect(treffer).toBeUndefined();
  });

  it("verwisselt twee leden niet", () => {
    const treffer = zoekBestaandeAfname(
      [kompasRij],
      { naam: "An Verlinden", email: "an@vanderlinde.be" },
      T4P_INSTRUMENT,
      "Vanderlinde Group",
    );
    expect(treffer).toBeUndefined();
  });
});

/**
 * Het trajectscherm zelf. Zonder route en zonder knop is de server-kant
 * waardeloos: de facilitator zag een lijst met trajecten, klikte erop en kwam op
 * de foutpagina. Daarom staat hier vast dat de route bestaat en dat het scherm
 * de twee fasen werkelijk kan uitsturen.
 */
describe("het trajectscherm van Human Due Diligence", () => {
  const scherm = readFileSync(
    resolve(__dirname, "../client/src/pages/hdd-traject.tsx"),
    "utf8",
  );
  const app = readFileSync(resolve(__dirname, "../client/src/App.tsx"), "utf8");

  it("is als route geregistreerd achter de coach-login", () => {
    expect(app).toContain('path="/hdd/traject/:id"');
    expect(app).toContain("<CoachLoginGate><HddTraject /></CoachLoginGate>");
    expect(app).toContain('import HddTraject from "@/pages/hdd-traject"');
  });

  it("is het adres waarnaar de trajectlijst verwijst", () => {
    const lijst = readFileSync(
      resolve(__dirname, "../client/src/pages/hdd-home.tsx"),
      "utf8",
    );
    expect(lijst).toContain("/hdd/traject/${tr.id}");
  });

  it("kan leden toevoegen en beide fasen uitsturen", () => {
    expect(scherm).toContain("/leden");
    expect(scherm).toContain("start-fase${opties.fase}");
    expect(scherm).toContain('data-testid="button-fase1-uitsturen"');
    expect(scherm).toContain('data-testid="button-fase2-uitsturen"');
    expect(scherm).toContain("/voortgang");
  });

  it("vangt een dichte mailweg en een leeg saldo op", () => {
    expect(scherm).toContain("MAILWEG_ONBRUIKBAAR");
    expect(scherm).toContain("tochUitsturen");
  });

  it("gebruikt hetzelfde voorvoegsel voor de API als de rest van de client", () => {
    expect(scherm).toContain("/port/5000");
  });

  it("bevat geen lange streepjes", () => {
    expect(scherm.includes("\u2014")).toBe(false);
    expect(scherm.includes("\u2013")).toBe(false);
  });
});
