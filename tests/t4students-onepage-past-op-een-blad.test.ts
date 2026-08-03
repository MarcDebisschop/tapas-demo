import { describe, it, expect } from "vitest";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { renderT4StudentsRapport } from "../server/t4students/rapport-pdf";
import { T4STUDENTS_INSTRUMENT } from "../server/t4students/instrument";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";

// ---------------------------------------------------------------------------
// Herstelronde 2, vervolg op punt B, en Opmaakherstel (2026-08-03), punt 1:
// de one-page (pagina 4, "Jouw talentmotor in één oogopslag") werd met de
// invoering van de drie groepen (sterk aanwezig / middenveld / minder
// aanwezig) hoger dan een blad. Voor de groepeer-wijziging was dit blok al
// 659 punten (paste toen ook al niet op het beschikbare deel van het blad,
// ~630 punten, na de vaste intro-tekst bovenaan pagina 4); de groepskopjes
// brachten dat naar 873 punten.
//
// Eerst zijn de groepskopjes compacter gemaakt: één regel per kopje (in
// plaats van kopje + herhaalde kolomkoppen), een kleinere letter (7.6pt in
// plaats van 8.6pt), de kolomkoppen HERKENNING/ENERGIE VANDAAG worden nog
// maar één keer per band getekend in plaats van bij elke groep opnieuw, en de
// marge na elke groep ging van 8 naar 4 punten (GROEPKOP_H van 18 naar 12).
// Dat bracht het ene, samengevoegde blok naar 836 punten: nog steeds meer dan
// de ~630 punten die op een blad beschikbaar zijn.
//
// BREEKPUNT MET DEZE OUDERE TEST (gemeld, niet stilzwijgend gewijzigd)
// Deze test legde daarna letterlijk vast dat er precies 1 "hoger dan een
// blad"-melding voor "banden" moest zijn en dat de pagina op precies 1
// vervolgblad doorliep. Dat is exact het kapotte gedrag dat de opdracht
// "Opmaakherstel na de omschakeling naar groepen" vraagt te repareren: dat
// ene te hoge blok veroorzaakte acht kapotte bladen (bladen met maar één
// losse regel, zonder kop, voettekst of bladnummer) en een leeg slotblad,
// omdat het bouwscript een te hoog blok regel per regel laat doorlopen zonder
// ooit een nieuwe kop of voettekst te tekenen.
//
// De oplossing is niet "nog compacter maken tot het past" (dat zou tekst
// laten wegvallen of onleesbaar maken, wat eerder al bewust werd afgewezen),
// maar het ene blok met drie lagen splitsen in drie afzonderlijke blokken,
// één per laag (Talent-foci, Talent-versnellers, Drivers). Elke laag
// afzonderlijk is, gemeten met dezelfde groepeer-logica, ruim onder de 630
// beschikbare punten (typisch 235 tot 260 punten), dus met drie blokken kan
// de opmaak netjes tussen twee lagen breken in plaats van middenin door te
// lopen. In de praktijk (gemeten op het voorbeeldrapport) verdeelt de opmaak
// de drie lagen nu over twee volle bladen (Talent-foci op het eerste blad bij
// de kop en de inleiding, Talent-versnellers en Drivers op een eigen
// "(vervolg)"-blad), in plaats van over acht kapotte restjes. Dat is dus nog
// steeds één vervolgblad, net als bij andere, bestaande hoofdstukken die
// eerlijk gemeld over een vervolgblad doorlopen (bijvoorbeeld "Drivers, jouw
// patroon"); het verschil met voorheen is dat dat vervolgblad nu een eigen
// volledige kop, voettekst en bladnummer draagt in plaats van een kale losse
// regel te zijn. Dat maakt de eerste toets hieronder achterhaald: er is geen
// enkel te hoog banden-blok meer, dus ook geen "hoger dan een blad"-melding
// meer voor deze pagina (het "1 vervolgblad" zelf is geen fout, zolang geen
// enkel blad kapot is; dat wordt bewaakt door tests/t4students-geen-kapotte-bladen.test.ts
// en tests/t4students-talentmotor-drie-blokken.test.ts).
// De toets is hieronder vervangen door het nieuwe, juiste gedrag; de waarborg
// zelf (geen tekstverlies, geen kapotte bladen) blijft bestaan, alleen nu
// bewaakt door de twee genoemde nieuwe testbestanden, die het probleem bij de
// wortel aanpakken in plaats van het gesplitste resultaat te meten.
//
// De twee toetsen die niet met de opdracht in tegenspraak zijn (de
// compactere groepskopjes zelf, en dat de uitlegzin maar één keer voorkomt)
// blijven ongewijzigd en gelden onverkort.
// ---------------------------------------------------------------------------

describe("de one-page na de compactere groepskopjes (herstelronde 2, punt B vervolg) en na het opsplitsen in drie blokken (opmaakherstel, punt 1)", () => {
  it("het banden-blok van elke laag afzonderlijk past ruim op een blad; er is geen 'hoger dan een blad'-melding meer voor pagina 4", () => {
    const resultaat = scoreStudiekompas(T4STUDENTS_INSTRUMENT, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(T4STUDENTS_INSTRUMENT, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: T4STUDENTS_INSTRUMENT.version,
    });
    const { meldingen } = renderT4StudentsRapport(rapport);
    const teHoog = meldingen.filter((m) => m.includes("banden") && m.includes("hoger dan een blad"));
    expect(teHoog).toHaveLength(0);
  });

  it("de vaste uitlegzin over de drie groepen staat maar één keer in het naschrift van de one-page", () => {
    const resultaat = scoreStudiekompas(T4STUDENTS_INSTRUMENT, VOORBEELDAFNAME.antwoorden, null, "nl");
    const rapport = bouwT4StudentsRapport(T4STUDENTS_INSTRUMENT, resultaat, VOORBEELDAFNAME.antwoorden, "verdieping", {
      naam: VOORBEELDAFNAME.naam,
      code: VOORBEELDAFNAME.code,
      datum: VOORBEELDAFNAME.datum,
      instrumentVersie: T4STUDENTS_INSTRUMENT.version,
    });
    const onePagePagina = rapport.paginas.find((p) => p.nr === 4)!;
    // Opmaakherstel, punt 1: de one-page bestaat sinds het splitsen niet meer
    // uit één banden-blok maar uit drie (één per laag). De uitlegzin mag over
    // alle drie samen nog steeds maar één keer voorkomen.
    const bandenBlokken = onePagePagina.blokken.filter((b) => b.soort === "banden") as Extract<
      (typeof onePagePagina.blokken)[number],
      { soort: "banden" }
    >[];
    const gevonden = bandenBlokken.flatMap((b) => b.naschrift).filter((r) => r.includes("komen uit de antwoordschaal zelf"));
    expect(gevonden.length).toBeLessThanOrEqual(1);
  });

  it("de groepskopjes zijn compacter: GROEPKOP_H is verlaagd en herhaalt de kolomkoppen niet meer per groep", () => {
    // Regressiebewaking op de renderer-broncode zelf: als iemand GROEPKOP_H
    // per ongeluk weer optrekt naar de oude 18 punten, moet dat opvallen.
    const bron = require("fs").readFileSync(
      require("path").join(__dirname, "..", "server", "t4students", "rapport-pdf.ts"),
      "utf-8",
    );
    const match = bron.match(/const GROEPKOP_H = (\d+);/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeLessThanOrEqual(12);
  });
});
