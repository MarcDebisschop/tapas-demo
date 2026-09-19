// ---------------------------------------------------------------------------
// tests/notulen-toc-redactie.test.ts  -  NIEUW BESTAND
//
// De redactieronde bovenop de notulenomzetting. Drie dingen moeten vaststaan.
//
// Eén: wat mechanisch te vervangen is, wordt vervangen, en elke vervanging komt
// in de tabel met wat er stond en wat er nu staat.
//
// Twee: wat betekenis raakt, blijft staan en wordt gemeld. Een machine die zelf
// een lange zin knipt of een lijdende vorm omzet, verandert de inhoud van een
// verslag dat naar aandeelhouders gaat.
//
// Drie: de kerngegevens blijven onaangeroerd. Daar staan namen, datums en
// plaatsen, en een woordenlijst heeft daar niets te zoeken.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { leegVerslag } from "../server/notulen-toc/model";
import { meldingenVoor, redigeerTekst, redigeerVerslag, splitsZinnen } from "../server/notulen-toc/redactie";

describe("redigeerTekst, de woordenlijst", () => {
  it("vervangt een Engelse leenvertaling en boekt ze in de tabel", () => {
    const uit = redigeerTekst("De planning loopt in lijn met de roadmap.", "Kernboodschap 1");
    expect(uit.tekst).toBe("De planning loopt volgens de planning.");
    expect(uit.wijzigingen).toHaveLength(2);
    expect(uit.wijzigingen[0]).toMatchObject({
      plaats: "Kernboodschap 1",
      categorie: "leenvertaling",
      voor: "in lijn met",
      na: "volgens",
    });
  });

  it("vervangt ambtelijke schrijftaal", () => {
    const uit = redigeerTekst("Teneinde de afspraak na te komen, bezorgt Fons het dossier.", "Actie 1");
    expect(uit.tekst).toContain("Om de afspraak na te komen");
    expect(uit.wijzigingen[0].categorie).toBe("schrijftaal");
  });

  it("houdt de hoofdletter van het origineel", () => {
    const uit = redigeerTekst("Inzake de facturatie volgt een nota.", "Besluit 1");
    expect(uit.tekst.startsWith("Over de facturatie")).toBe(true);
  });

  it("vervangt een Belgische vorm die geen standaardtaal is", () => {
    const uit = redigeerTekst("Het dossier wordt op punt gesteld tegen dat de raad zetelt.", "Actie 2");
    expect(uit.tekst).toContain("voordat de raad zetelt");
    expect(uit.wijzigingen.some((w) => w.categorie === "belgisch")).toBe(true);
  });

  it("laat een tekst zonder treffers letterlijk staan", () => {
    const zin = "Andrea bezorgt het verslag aan de leden voor vrijdag.";
    const uit = redigeerTekst(zin, "Actie 3");
    expect(uit.tekst).toBe(zin);
    expect(uit.wijzigingen).toHaveLength(0);
  });

  it("laat een lege tekst met rust", () => {
    expect(redigeerTekst("", "Doel 1").tekst).toBe("");
    expect(redigeerTekst("   ", "Doel 1").wijzigingen).toHaveLength(0);
  });
});

describe("meldingenVoor, wat een mens moet beslissen", () => {
  it("meldt een zin die te lang is en verandert hem niet", () => {
    const lang =
      "Het team bespreekt de planning van het platform en de psychometrie en de commercie en " +
      "de organisatie en het coachnetwerk en de academie en het merk en de financiën en de " +
      "samenwerking binnen het geheel van de leden.";
    const uit = redigeerTekst(lang, "Bespreking 1");
    expect(uit.tekst).toBe(lang);
    expect(uit.aandacht.some((a) => a.categorie === "lange zin")).toBe(true);
  });

  it("meldt een lijdende vorm met een dader in de zin", () => {
    const meldingen = meldingenVoor("Het verslag wordt nagekeken door Herman Van Esbroeck.", "Besluit 2");
    expect(meldingen.some((m) => m.categorie === "lijdende vorm")).toBe(true);
  });

  it("meldt een verwijswoord vooraan dat niets benoemt", () => {
    const meldingen = meldingenVoor("Dit vraagt nog uitwerking.", "Bespreking 2");
    expect(meldingen.some((m) => m.categorie === "verwijswoord")).toBe(true);
  });

  it("meldt geen verwijswoord wanneer de zaak erachter staat", () => {
    const meldingen = meldingenVoor("Dit verslag gaat naar de leden.", "Bespreking 3");
    expect(meldingen.some((m) => m.categorie === "verwijswoord")).toBe(false);
  });

  it("splitst zinnen op punt, vraagteken en uitroepteken", () => {
    expect(splitsZinnen("Een. Twee? Drie!")).toHaveLength(3);
  });
});

describe("redigeerVerslag, het geheel", () => {
  it("redigeert de inhoud en levert de tabel op", () => {
    const inhoud = leegVerslag();
    inhoud.kernboodschap.push("De implementatie van het platform loopt in lijn met de planning.");
    inhoud.acties.push({
      nr: "A1",
      tekst: "Fons finaliseert het dossier asap.",
      eigenaar: "Fons Feekens",
      deadline: "30 september 2026",
      prioriteit: "hoog",
    });

    const rapport = redigeerVerslag(inhoud);

    expect(inhoud.kernboodschap[0]).toBe("De invoering van het platform loopt volgens de planning.");
    expect(inhoud.acties[0].tekst).toBe("Fons voltooit het dossier zo snel mogelijk.");
    expect(rapport.aantalWijzigingen).toBe(4);
    expect(rapport.leesrondeNodig).toBe(true);
    expect(rapport.slotwoord).toContain("niet heeft getypt");
    expect(rapport.wijzigingen.every((w) => w.plaats.length > 0)).toBe(true);
  });

  it("laat de kerngegevens onaangeroerd, want daar staan namen en plaatsen", () => {
    const inhoud = leegVerslag();
    inhoud.kerngegevens.locatie = "Meeting Point, Antwerpen";
    inhoud.kerngegevens.vergadering = "Team of Captains, tweede meeting";

    redigeerVerslag(inhoud);

    expect(inhoud.kerngegevens.locatie).toBe("Meeting Point, Antwerpen");
    expect(inhoud.kerngegevens.vergadering).toBe("Team of Captains, tweede meeting");
  });

  it("meet de zinslengte en het aandeel lijdende vorm", () => {
    const inhoud = leegVerslag();
    inhoud.doel.push("Het team beslist over de prijszetting.");
    inhoud.doel.push("Het verslag wordt nagekeken.");

    const rapport = redigeerVerslag(inhoud);

    expect(rapport.gemiddeldeZinslengte).toBeGreaterThan(0);
    expect(rapport.lijdendeVormProcent).toBe(50);
  });

  it("levert een leeg rapport voor een leeg verslag en werpt niet", () => {
    const rapport = redigeerVerslag(leegVerslag());
    expect(rapport.aantalWijzigingen).toBe(0);
    expect(rapport.aandacht).toHaveLength(0);
    expect(rapport.gemiddeldeZinslengte).toBe(0);
  });

  it("zet nergens een gedachtestreepje in de eigen teksten", () => {
    const rapport = redigeerVerslag(leegVerslag());
    expect(/[\u2014\u2013]/.test(rapport.slotwoord)).toBe(false);
  });
});
