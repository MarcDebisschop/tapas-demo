import { describe, it, expect } from "vitest";
import { T4STUDENTS_INSTRUMENT as I } from "../server/t4students/instrument";
import { scoreStudiekompas } from "../server/t4students/kompas-scoring";
import { bouwT4StudentsRapport } from "../server/t4students/rapport-paginas";
import { VOORBEELDAFNAME } from "../server/t4students/rapport-voorbeeld";
import type { T4SPagina } from "../server/t4students/rapport-contract";

// ---------------------------------------------------------------------------
// Onderdeel B2 van de opdracht "Studiekompas persoonlijk maken".
//
// Vlak na "Hoe je dit rapport leest" komt een nieuw blad met de kop
// "Dit hoopte je te vinden". Het toont het letterlijke antwoord op de
// beginvraag P0. Is P0 niet beantwoord, dan komt er nergens een blok met dat
// antwoord op het blad, en het blad zelf blijft wel bestaan (het is de
// bladzijde net na de leeswijzer), maar zonder dat blok.
//
// Opmaakherstel-2, punt 1 en 4 (vindplaats verlegd, bewaakte tekst en
// aanwezigheidsgedrag behouden): dit is de eigen, letterlijke tekst van de
// student, dus hoort ze thuis in het INGETOGEN VLAK ("kaartvlak", getint,
// zonder balk, schuin en tussen aanhalingstekens), niet langer in de witte
// UITLEGKAART ("kader"). De oorspronkelijke test keek naar b.soort ===
// "kader"; dat is verlegd naar "kaartvlak". De bewaakte inhoud (het
// letterlijke antwoord verschijnt wanneer P0 beantwoord is, en het blok
// ontbreekt volledig wanneer P0 niet of alleen met witruimte beantwoord is)
// is ongewijzigd.
// ---------------------------------------------------------------------------

function bouw(antwoorden: Record<string, unknown>) {
  const resultaat = scoreStudiekompas(I, antwoorden as never, null, "nl");
  return bouwT4StudentsRapport(I, resultaat, antwoorden as never, "verdieping", {
    naam: "Test",
    code: "T4S-0000-0000",
    datum: "2 augustus 2026",
    instrumentVersie: I.version,
  });
}

function vindBlad(paginas: T4SPagina[]): T4SPagina | undefined {
  return paginas.find((p) => /dit hoopte je te vinden/i.test(p.titel));
}

describe("het blad Dit hoopte je te vinden toont het letterlijke antwoord op P0", () => {
  it("bestaat, en staat meteen na Hoe je dit rapport leest", () => {
    const rapport = bouw(VOORBEELDAFNAME.antwoorden as unknown as Record<string, unknown>);
    const blad = vindBlad(rapport.paginas);
    expect(blad, "geen blad Dit hoopte je te vinden gevonden").toBeDefined();
    const leeswijzer = rapport.paginas.find((p) => /hoe je dit rapport leest/i.test(p.titel));
    expect(leeswijzer).toBeDefined();
    const posLeeswijzer = rapport.paginas.indexOf(leeswijzer!);
    const posBlad = rapport.paginas.indexOf(blad!);
    expect(posBlad).toBe(posLeeswijzer + 1);
  });

  it("toont het letterlijke antwoord op P0 in het ingetogen vlak (kaartvlak) wanneer P0 beantwoord is", () => {
    const antwoorden = {
      ...VOORBEELDAFNAME.antwoorden,
      P0: { text: "Ik hoop te weten of ik beter wetenschappen of kunst kan kiezen." },
    };
    const rapport = bouw(antwoorden as unknown as Record<string, unknown>);
    const blad = vindBlad(rapport.paginas)!;
    const vlak = blad.blokken.find(
      (b) => b.soort === "kaartvlak" && /ik hoop te weten of ik beter wetenschappen of kunst kan kiezen/i.test(b.tekst),
    );
    expect(vlak, "geen kaartvlak met het letterlijke antwoord gevonden").toBeDefined();
  });

  it("laat het ingetogen vlak volledig weg wanneer P0 niet beantwoord is", () => {
    const antwoorden = { ...VOORBEELDAFNAME.antwoorden } as Record<string, unknown>;
    delete (antwoorden as Record<string, unknown>).P0;
    const rapport = bouw(antwoorden);
    const blad = vindBlad(rapport.paginas)!;
    const vlak = blad.blokken.find((b) => b.soort === "kaartvlak");
    expect(vlak).toBeUndefined();
  });

  it("laat het ingetogen vlak ook weg wanneer P0 een lege of enkel witruimte tekst heeft", () => {
    const antwoorden = { ...VOORBEELDAFNAME.antwoorden, P0: { text: "   " } };
    const rapport = bouw(antwoorden as unknown as Record<string, unknown>);
    const blad = vindBlad(rapport.paginas)!;
    const vlak = blad.blokken.find((b) => b.soort === "kaartvlak");
    expect(vlak).toBeUndefined();
  });
});
