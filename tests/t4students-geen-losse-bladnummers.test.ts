import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import type { T4SBlok, T4SPagina } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Drie verwijzingen die niet klopten (zie opdracht-verwijzingen.md).
//
// 1 en 2. Twee vaste bladnummers in de lopende tekst ("pagina 5", "pagina 3")
//    wezen niet meer naar het blad waar ze het over hadden, doordat de
//    opmaak sindsdien is veranderd. Vaste nummers in de tekst schuiven mee
//    zodra de opmaak verandert; de titel van het hoofdstuk niet. Deze test
//    rekent een echte afname door de motor en de rapportlaag en doorzoekt de
//    werkelijk gebouwde tekst van basis en verdieping op elke overgebleven
//    verwijzing naar "pagina <cijfer>" of "blad <cijfer>", los van het
//    bladnummer dat de opmaaklaag zelf in de voettekst zet (dat nummer staat
//    niet in T4SPagina/T4SBlok, maar wordt pas in de PDF-laag toegevoegd, en
//    valt dus buiten dit onderzoek).
//
// 3. Op het blad "In een zin" verwees "de groepen hierboven" naar niets: op
//    dat blad staan geen groepen. Vervangen door "de groepen op de bladen
//    hiervoor".
// ---------------------------------------------------------------------------

/** Alle tekstvelden uit een blok van het Studiekompas, plat getrokken. */
function tekstenUitBlok(blok: T4SBlok): string[] {
  const uit: string[] = [];
  if ("tekst" in blok && typeof blok.tekst === "string") uit.push(blok.tekst);
  if ("kop" in blok && typeof blok.kop === "string") uit.push(blok.kop);
  if ("kopLinks" in blok && typeof blok.kopLinks === "string") uit.push(blok.kopLinks);
  if ("kopRechts" in blok && typeof blok.kopRechts === "string") uit.push(blok.kopRechts);
  if ("onderschrift" in blok && typeof (blok as { onderschrift?: string }).onderschrift === "string") {
    uit.push((blok as { onderschrift: string }).onderschrift);
  }
  if ("duiding" in blok && typeof blok.duiding === "string") uit.push(blok.duiding);
  if ("omschrijving" in blok && typeof blok.omschrijving === "string") uit.push(blok.omschrijving);
  if ("punten" in blok && Array.isArray(blok.punten)) uit.push(...blok.punten);
  if ("vragen" in blok && Array.isArray(blok.vragen)) uit.push(...blok.vragen);
  if ("legende" in blok && Array.isArray(blok.legende)) uit.push(...blok.legende);
  if ("naschrift" in blok && Array.isArray(blok.naschrift)) uit.push(...blok.naschrift);
  if ("paren" in blok && Array.isArray(blok.paren)) {
    for (const p of blok.paren) uit.push(p.label, p.waarde);
  }
  if ("regels" in blok && Array.isArray(blok.regels)) {
    for (const r of blok.regels as { vraag?: string }[]) {
      if (typeof r.vraag === "string") uit.push(r.vraag);
    }
  }
  if ("links" in blok && Array.isArray((blok as { links?: unknown[] }).links)) {
    for (const r of (blok as { links: { vraag: string }[] }).links) uit.push(r.vraag);
  }
  if ("rechts" in blok && Array.isArray((blok as { rechts?: unknown[] }).rechts)) {
    for (const r of (blok as { rechts: { vraag: string }[] }).rechts) uit.push(r.vraag);
  }
  if ("banden" in blok && Array.isArray(blok.banden)) {
    for (const band of blok.banden) {
      uit.push(band.titel, band.onderschrift);
      if (band.noot) uit.push(band.noot);
    }
  }
  return uit;
}

function alleTeksten(paginas: T4SPagina[]): { pagina: T4SPagina; tekst: string }[] {
  return paginas.map((pagina) => {
    const stukken: string[] = [pagina.titel, pagina.ondertitel];
    for (const blok of pagina.blokken) stukken.push(...tekstenUitBlok(blok));
    return { pagina, tekst: stukken.join(" \n ") };
  });
}

// "pagina" of "blad" gevolgd door een cijfer, als woordgrens (niet
// "Publicatieblad", dat is een bronvermelding en geen bladverwijzing).
const LOS_PAGINACIJFER = /\b(pagina|blad)\s*[0-9]+/i;

function bouwBeideLicenties() {
  const resultaat = scoreStudiekompas(I, VOORBEELDAFNAME.antwoorden, null, "nl");
  return (["basis", "verdieping"] as const).map((licentie) => ({
    licentie,
    rapport: bouwT4StudentsRapport(I, resultaat, VOORBEELDAFNAME.antwoorden, licentie, {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: I.version,
    }),
  }));
}

describe("het Studiekompas verwijst niet meer met een los bladnummer naar een ander blad", () => {
  it("geen enkel blok in basis of verdieping bevat nog 'pagina <cijfer>' of 'blad <cijfer>'", () => {
    for (const { licentie, rapport } of bouwBeideLicenties()) {
      for (const { pagina, tekst } of alleTeksten(rapport.paginas)) {
        const treffer = tekst.match(LOS_PAGINACIJFER);
        expect(treffer, `${licentie}, pagina ${pagina.nr} (${pagina.titel}): "${treffer?.[0]}"`).toBeNull();
      }
    }
  });

  it("de verwijzing naar TaPas-BEELD noemt de titel van het hoofdstuk, geen bladnummer", () => {
    for (const { rapport } of bouwBeideLicenties()) {
      const alle = alleTeksten(rapport.paginas)
        .map((r) => r.tekst)
        .join(" \n ");
      expect(alle).toContain("dat lees je apart op het blad Jouw beeld van jezelf");
      expect(alle).not.toContain("dat lees je apart op pagina 5");
    }
  });

  it("de verwijzing bij TaPas-BEELD naar de drie lagen noemt de titel van het hoofdstuk, geen bladnummer", () => {
    for (const { rapport } of bouwBeideLicenties()) {
      const alle = alleTeksten(rapport.paginas)
        .map((r) => r.tekst)
        .join(" \n ");
      expect(alle).toContain("niet bij de drie lagen op het blad Jouw talentmotor in één oogopslag, maar hier apart");
      expect(alle).not.toContain("niet bij de drie lagen op pagina 3");
    }
  });
});

describe("het blad 'In een zin' verwijst niet meer naar 'de groepen hierboven'", () => {
  it("de uitlegzin verwijst naar de groepen op de bladen hiervoor, niet naar 'hierboven'", () => {
    for (const { rapport } of bouwBeideLicenties()) {
      const alle = alleTeksten(rapport.paginas)
        .map((r) => r.tekst)
        .join(" \n ");
      expect(alle).toContain(
        "De twee lijstjes hieronder komen niet uit de groepen op de bladen hiervoor, maar uit de verhouding tussen",
      );
      expect(alle).not.toContain("komen niet uit de groepen hierboven");
    }
  });
});
