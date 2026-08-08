import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const wortel = resolve(__dirname, "..");
const lees = (pad: string) => readFileSync(resolve(wortel, pad), "utf8");

const schermBron = lees("client/src/pages/traject-scherm.tsx");
const appBron = lees("client/src/App.tsx");
const beheerBron = lees("client/src/pages/admin.tsx");

describe("hoofdscherm van de Regiekamer", () => {
  it("vraagt het volledige traject in een keer op via de afgesproken route", () => {
    expect(schermBron).toContain('queryKey: ["/api/traject/trajecten", trajectId]');
    expect(schermBron).not.toContain("metIndruk=true");
  });

  it("toont vraagtoestanden in gewone taal", () => {
    expect(schermBron).toContain('in_behandeling: "in behandeling"');
    expect(schermBron).toContain('data-testid="toestand-in-behandeling"');
    expect(schermBron).not.toContain(">in_behandeling<");
  });

  it("maakt een overschreden termijn zichtbaar anders", () => {
    expect(schermBron).toContain('data-testid="kaart-over-termijn"');
    expect(schermBron).toContain("isOverschreden");
    expect(schermBron).toContain("over termijn");
  });

  it("baseert de AANDACHT-lijst en de kaartrand op het aandachtveld van de server", () => {
    expect(schermBron).toContain("vraagtAandacht: boolean");
    expect(schermBron).toContain("if (vraag.vraagtAandacht) {");
    expect(schermBron).toContain(".filter((vraag) => vraag.vraagtAandacht)");
    expect(schermBron).not.toContain(".filter((vraag) => vraag.isOverschreden)");
    expect(schermBron).not.toContain("if (vraag.isOverschreden) {");
  });

  it("geeft de vragenstroom een eigen rij over de volle breedte", () => {
    expect(schermBron).toContain('data-testid="vragenstroom-volle-breedte"');
    expect(schermBron).toContain("Schuif zijwaarts");
  });

  it("zet de partijlabels buiten de knoop met ruimte voor twee regels", () => {
    expect(schermBron).toContain("function bepaalPartijLabel");
    expect(schermBron).toContain("textAnchor={label.anker}");
    expect(schermBron).not.toContain('y={positie.y + 11.5}');
  });

  it("legt voor ieder leeg onderdeel uit wat er is en wat er kan", () => {
    expect(schermBron).toContain("Er zijn nog geen lijnen in dit traject.");
    expect(schermBron).toContain("Er zijn nog geen gebeurtenissen op deze lijn.");
    expect(schermBron).toContain("Er zijn nog geen vragen in deze kolom.");
  });

  it("hangt het scherm achter de beheerderpoort en zet de ingang bij organisatie", () => {
    expect(appBron).toContain('path="/admin/trajecten/:trajectId"');
    expect(appBron).toContain("<AdminLoginGate><TrajectScherm /></AdminLoginGate>");
    expect(beheerBron).toContain('data-testid="link-regiekamer"');
  });
});
