// ---------------------------------------------------------------------------
// tests/link-zonder-code.test.ts  -  NIEUW BESTAND
//
// AANLEIDING. Een lid van het Team of Captains kreeg een uitnodiging met het adres
// "https://tapas-demo.onrender.com/deelnemer/". De code stond er niet in, en de
// link kwam dus op een foutpagina uit. De oorzaak lag in het opzoeken van een
// bestaande uitnodiging: dat gebeurde met ruwe sql ("SELECT * FROM afnames"), die
// de kolomnamen van de databank teruggeeft (invite_token), terwijl de code
// inviteToken las. Het antwoord werd toch als Afname gelezen, dus de compiler
// zweeg en het token was altijd undefined.
//
// Deze tests houden twee dingen vast: het opzoeken geeft de code wel terug, en
// geen enkele linkbouwer levert nog een adres zonder code af.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { bouwDeelnemerLink } from "../server/uitnodigingsmail";

describe("een link zonder code komt er niet meer", () => {
  it("levert niets bij een leeg token", () => {
    expect(bouwDeelnemerLink("https://tapas.example", "")).toBe("");
    expect(bouwDeelnemerLink("https://tapas.example", "   ")).toBe("");
    expect(bouwDeelnemerLink("https://tapas.example", null as unknown as string)).toBe("");
  });

  it("levert wel een link bij een echt token", () => {
    expect(bouwDeelnemerLink("https://tapas.example", "abc123")).toBe(
      "https://tapas.example/deelnemer/abc123",
    );
  });

  it("eindigt nooit op een schuine streep na deelnemer", () => {
    for (const token of ["", " ", "\t"]) {
      const link = bouwDeelnemerLink("https://tapas.example", token);
      expect(link.endsWith("/deelnemer/")).toBe(false);
    }
  });
});

describe("het opzoeken van een bestaande uitnodiging", () => {
  // De ruwe sql gaf snake_case terug. Deze test beschrijft de val zelf, zodat
  // niemand haar opnieuw zet: wie met sqlite.prepare("SELECT *") werkt, leest
  // invite_token, en wie de rij als Afname behandelt, krijgt undefined.
  it("een rij uit ruwe sql draagt invite_token, niet inviteToken", async () => {
    const { sqlite, storage } = await import("../server/storage");
    const gemaakt = await storage.maakUitnodiging({ name: "Proef Persoon", instrumentId: "hdd" });
    expect(gemaakt.inviteToken).toBeTruthy();

    const ruw = sqlite
      .prepare("SELECT * FROM afnames WHERE id = ?")
      .get(gemaakt.id) as Record<string, unknown>;
    expect(ruw.invite_token).toBe(gemaakt.inviteToken);
    expect(ruw.inviteToken).toBeUndefined();

    // En de weg via drizzle, die de bulk-import nu gebruikt, geeft de code wel.
    const viaToken = await storage.getAfnameByToken(gemaakt.inviteToken as string);
    expect(viaToken?.inviteToken).toBe(gemaakt.inviteToken);
  });
});
