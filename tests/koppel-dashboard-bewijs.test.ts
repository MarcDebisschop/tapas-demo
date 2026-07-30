// ---------------------------------------------------------------------------
// tests/koppel-dashboard-bewijs.test.ts - Auditbevinding K-1 (kritiek).
//
// Wat deze tests bewijzen:
//   1. Koppelen zonder bezitsbewijs is onmogelijk: een leeg, fout of gegokt
//      bewijs wordt geweigerd. Enkel de respondentCode of het invite-token van
//      DEZE afname geldt.
//   2. Een bestaande koppeling wordt nooit overschreven: hetzelfde e-mailadres
//      blijft idempotent doorlopen, een ander adres wordt geweigerd.
//   3. De route zelf gebruikt beide poortwachters, antwoordt met 404 bij een
//      ongeldig bewijs (en niet met 403, dat zou het bestaan van de afname
//      verklappen) en met 409 bij een bestaande koppeling.
//   4. Het pad staat onder de authLimiter in server/index.ts.
//   5. Het eindscherm stuurt de respondentCode mee.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  bewijsGeldig,
  bewijsUitBody,
  koppelBeslissing,
  normaliseerEmail,
} from "../server/koppel-bewijs";

const AFNAME = {
  respondentCode: "R-7f3a91c2e5",
  inviteToken: "inv-8b21d4a09c6e",
  deelnemerEmail: null as string | null,
};

describe("K-1: bezitsbewijs bij het koppelen van een dashboard", () => {
  it("aanvaardt de respondentCode van deze afname", () => {
    expect(bewijsGeldig(AFNAME, AFNAME.respondentCode)).toBe(true);
    expect(bewijsGeldig(AFNAME, ` ${AFNAME.respondentCode} `)).toBe(true);
  });

  it("aanvaardt het invite-token van deze afname", () => {
    expect(bewijsGeldig(AFNAME, AFNAME.inviteToken)).toBe(true);
  });

  it("weigert een leeg, ontbrekend of enkel-witruimte bewijs", () => {
    for (const ruw of ["", "   ", "\n"]) {
      expect(bewijsGeldig(AFNAME, ruw)).toBe(false);
    }
    expect(bewijsGeldig(AFNAME, bewijsUitBody({}))).toBe(false);
    expect(bewijsGeldig(AFNAME, bewijsUitBody(undefined))).toBe(false);
    expect(bewijsGeldig(AFNAME, bewijsUitBody({ email: "iemand@example.com" }))).toBe(false);
  });

  it("weigert een gegokt of bijna-juist bewijs, en de code van een andere afname", () => {
    expect(bewijsGeldig(AFNAME, "R-7f3a91c2e4")).toBe(false); // laatste teken anders
    expect(bewijsGeldig(AFNAME, "R-7f3a91c2")).toBe(false); // korter
    expect(bewijsGeldig(AFNAME, "42")).toBe(false); // het id zelf
    expect(bewijsGeldig(AFNAME, "R-ANDEREAFNAME")).toBe(false);
  });

  it("weigert alles wanneer de afname zelf geen code of token heeft", () => {
    const leeg = { respondentCode: null, inviteToken: null, deelnemerEmail: null };
    expect(bewijsGeldig(leeg, "")).toBe(false);
    expect(bewijsGeldig(leeg, "wat dan ook")).toBe(false);
  });

  it("haalt het bewijs uit respondentCode, token of bewijs in de body", () => {
    expect(bewijsUitBody({ respondentCode: "abc" })).toBe("abc");
    expect(bewijsUitBody({ token: "def" })).toBe("def");
    expect(bewijsUitBody({ bewijs: "ghi" })).toBe("ghi");
    expect(bewijsUitBody({ respondentCode: 123 })).toBe(""); // geen tekst = geen bewijs
  });
});

describe("K-1: een bestaande koppeling wordt nooit overschreven", () => {
  it("laat een eerste koppeling toe", () => {
    const b = koppelBeslissing({ deelnemerEmail: null }, "nieuw@example.com");
    expect(b).toEqual({ toegestaan: true, reeds: false });
  });

  it("blijft idempotent voor hetzelfde adres, ook met andere schrijfwijze", () => {
    const b = koppelBeslissing({ deelnemerEmail: "Marc@Example.com" }, " marc@example.com ");
    expect(b).toEqual({ toegestaan: true, reeds: true });
  });

  it("weigert een ander adres op een al gekoppelde afname", () => {
    const b = koppelBeslissing({ deelnemerEmail: "eigenaar@example.com" }, "aanvaller@example.com");
    expect(b.toegestaan).toBe(false);
    expect(b).toMatchObject({ reden: "reeds-gekoppeld" });
  });

  it("normaliseert e-mailadressen op dezelfde manier als de opslaglaag", () => {
    expect(normaliseerEmail("  MARC@Example.COM ")).toBe("marc@example.com");
  });
});

describe("K-1: de route past de poortwachters ook echt toe", () => {
  const route = readFileSync(resolve(__dirname, "../server/routes/afnames.ts"), "utf8");
  const index = readFileSync(resolve(__dirname, "../server/index.ts"), "utf8");
  const klaar = readFileSync(resolve(__dirname, "../client/src/pages/klaar.tsx"), "utf8");

  // Enkel het blok van deze route bekijken, niet het hele bestand.
  const start = route.indexOf('app.post("/api/afnames/:id/koppel-dashboard"');
  const blok = route.slice(start, start + 2000);

  it("registreert de route", () => {
    expect(start).toBeGreaterThan(-1);
  });

  it("controleert het bewijs en antwoordt met 404 bij een ongeldig bewijs", () => {
    expect(blok).toMatch(/bewijsGeldig\(\s*a\s*,\s*bewijsUitBody\(req\.body\)\s*\)/);
    const bewijsIndex = blok.indexOf("bewijsGeldig");
    const naBewijs = blok.slice(bewijsIndex, bewijsIndex + 200);
    expect(naBewijs).toContain("status(404)");
    expect(naBewijs).not.toContain("status(403)");
  });

  it("controleert het bewijs voordat er iets weggeschreven wordt", () => {
    expect(blok.indexOf("bewijsGeldig")).toBeLessThan(blok.indexOf("koppelAfnameAanDeelnemer"));
    expect(blok.indexOf("bewijsGeldig")).toBeLessThan(blok.indexOf("vindOfMaakDeelnemer"));
  });

  it("weigert overschrijven met 409 en schrijft niet bij een bestaande koppeling", () => {
    expect(blok).toMatch(/koppelBeslissing\(\s*a\s*,\s*emailRaw\s*\)/);
    expect(blok).toContain("status(409)");
    expect(blok).toMatch(/if\s*\(\s*!beslissing\.reeds\s*\)\s*\{[\s\S]{0,120}koppelAfnameAanDeelnemer/);
  });

  // Tweede auditronde: dit pad staat niet langer onder de ruime authLimiter maar
  // onder de eigen, strengere koppelLimiter (zie tests/afronden-en-gezondheid.test.ts).
  it("staat onder de strengere snelheidsbegrenzing van de koppelLimiter", () => {
    expect(index).toContain('"/api/afnames/:id/koppel-dashboard"');
    const gebruik = index.match(/app\.use\(\[[^\]]*\],\s*koppelLimiter\);/);
    expect(gebruik, "koppelLimiter wordt niet toegepast").not.toBeNull();
    expect(gebruik![0]).toContain('"/api/afnames/:id/koppel-dashboard"');
  });

  it("laat het eindscherm de respondentCode meesturen", () => {
    expect(klaar).toMatch(/koppel-dashboard[\s\S]{0,200}respondentCode/);
  });
});
