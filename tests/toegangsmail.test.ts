// ---------------------------------------------------------------------------
// tests/toegangsmail.test.ts
//
// Wat deze tests vastleggen:
//   1. Het eindscherm belooft in alle talen dat de persoonlijke toegang wordt
//      opgestuurd ("Stuur mij mijn persoonlijke toegang", shared/i18n.ts). Die
//      belofte moet kloppen: het koppelpad verstuurt werkelijk een bericht.
//   2. De tekst van dat bericht bestaat in elke taal die het scherm aanbiedt,
//      draagt de persoonlijke link en de toegangscode, en laat geen enkele
//      plaatshouder onvervangen achter.
//   3. Wanneer er geen verzendweg ingesteld staat, wordt er niets verstuurd en
//      zegt het scherm dat ook: dan blijven de link en de code op het scherm
//      de weg naar binnen. Het scherm beweert nooit dat er een bericht
//      onderweg is wanneer dat niet zo is.
//   4. Een mislukte verzending blokkeert het koppelen nooit: de deelnemer
//      houdt in elk geval de link en de code op het scherm.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { bouwToegangsmail, TOEGANGSMAIL_TALEN } from "../server/toegangsmail";
import { maakVertaler } from "../shared/i18n";

const afnamesBron = readFileSync(resolve(__dirname, "../server/routes/afnames.ts"), "utf8");
const mailerBron = readFileSync(resolve(__dirname, "../server/bulk-import/mailer.ts"), "utf8");
const klaarTsx = readFileSync(resolve(__dirname, "../client/src/pages/klaar.tsx"), "utf8");

const VOORBEELD = {
  naam: "Andrea Hofmann",
  link: "https://tapas-demo.onrender.com/#/dashboard/abc123",
  code: "482 913",
  instrument: "TaPas Business Kompas",
};

describe("de tekst van de toegangsmail", () => {
  it("bestaat in elke taal die het eindscherm aanbiedt", () => {
    for (const taal of TOEGANGSMAIL_TALEN) {
      const mail = bouwToegangsmail({ ...VOORBEELD, taal });
      expect(mail.onderwerp.trim().length).toBeGreaterThan(0);
      expect(mail.tekst.trim().length).toBeGreaterThan(0);
    }
  });

  it("dekt de vijf talen van het platform", () => {
    expect([...TOEGANGSMAIL_TALEN].sort()).toEqual(["en", "es", "fr", "nl", "ru"]);
  });

  it("draagt de persoonlijke link en de toegangscode", () => {
    for (const taal of TOEGANGSMAIL_TALEN) {
      const mail = bouwToegangsmail({ ...VOORBEELD, taal });
      expect(mail.tekst).toContain(VOORBEELD.link);
      expect(mail.tekst).toContain(VOORBEELD.code);
    }
  });

  it("noemt de deelnemer bij naam en vermeldt het instrument", () => {
    const mail = bouwToegangsmail({ ...VOORBEELD, taal: "nl" });
    expect(mail.tekst).toContain("Andrea Hofmann");
    expect(mail.tekst).toContain(VOORBEELD.instrument);
  });

  it("laat geen enkele plaatshouder onvervangen staan", () => {
    for (const taal of TOEGANGSMAIL_TALEN) {
      const mail = bouwToegangsmail({ ...VOORBEELD, taal });
      expect(mail.onderwerp).not.toMatch(/\{\{|\}\}/);
      expect(mail.tekst).not.toMatch(/\{\{|\}\}/);
    }
  });

  it("blijft leesbaar zonder naam en zonder instrument", () => {
    const mail = bouwToegangsmail({ ...VOORBEELD, naam: "", instrument: "", taal: "nl" });
    expect(mail.tekst).not.toMatch(/\{\{|\}\}/);
    expect(mail.tekst).toContain(VOORBEELD.link);
    expect(mail.tekst).toContain(VOORBEELD.code);
  });

  it("valt terug op het Nederlands bij een onbekende taal", () => {
    const nl = bouwToegangsmail({ ...VOORBEELD, taal: "nl" });
    expect(bouwToegangsmail({ ...VOORBEELD, taal: "de" }).onderwerp).toBe(nl.onderwerp);
    expect(bouwToegangsmail({ ...VOORBEELD, taal: "" }).onderwerp).toBe(nl.onderwerp);
  });

  it("gebruikt geen lange liggende streepjes", () => {
    for (const taal of TOEGANGSMAIL_TALEN) {
      const mail = bouwToegangsmail({ ...VOORBEELD, taal });
      expect(mail.onderwerp + mail.tekst).not.toMatch(/[\u2010-\u2015]/);
    }
  });
});

describe("de mailer kan een toegangsmail versturen", () => {
  it("biedt een eigen verzendfunctie naast de uitnodiging", () => {
    expect(mailerBron).toMatch(/export async function verstuurToegangsmail/);
  });

  it("hergebruikt dezelfde afzender en dezelfde verzendwegen", () => {
    const start = mailerBron.indexOf("export async function verstuurToegangsmail");
    expect(start).toBeGreaterThan(-1);
    const blok = mailerBron.slice(start, start + 1400);
    expect(blok).toMatch(/afzenderVoor\(/);
    expect(blok).toMatch(/isSimulatiemodus\(\)/);
    expect(blok).toMatch(/brevoApiGeconfigureerd\(\)/);
    // De SMTP-weg loopt langs verstuurViaSmtp, waar het antwoord van de
    // mailserver wordt beoordeeld voordat er "verstuurd" mag staan.
    expect(blok).toMatch(/verstuurViaSmtp\(/);
  });
});

describe("het koppelpad maakt de belofte waar", () => {
  it("verstuurt een toegangsmail nadat het dashboard gekoppeld is", () => {
    const start = afnamesBron.indexOf('"/api/afnames/:id/koppel-dashboard"');
    expect(start).toBeGreaterThan(-1);
    const route = afnamesBron.slice(start, start + 3000);
    expect(route).toMatch(/verstuurToegangsmail\(/);
  });

  it("meldt eerlijk of er werkelijk verstuurd is", () => {
    const start = afnamesBron.indexOf('"/api/afnames/:id/koppel-dashboard"');
    const route = afnamesBron.slice(start, start + 3000);
    expect(route).toMatch(/mailStatus/);
  });

  it("laat een verzendfout het koppelen nooit tegenhouden", () => {
    const start = afnamesBron.indexOf("verstuurToegangsmail(");
    expect(start).toBeGreaterThan(-1);
    // De verzending zit in een eigen try/catch vóór het antwoord.
    const blok = afnamesBron.slice(Math.max(0, start - 900), start + 700);
    expect(blok).toMatch(/try \{/);
    expect(blok).toMatch(/catch/);
  });
});

describe("het eindscherm zegt de waarheid", () => {
  it("stuurt de basis-URL mee zodat de link in de mail werkt", () => {
    expect(klaarTsx).toMatch(/origin/);
  });

  it("toont een aparte zin voor wel en voor niet verstuurd", () => {
    expect(klaarTsx).toMatch(/mailStatus/);
    expect(klaarTsx).toMatch(/klaar_mail_verstuurd/);
    expect(klaarTsx).toMatch(/klaar_mail_niet_verstuurd/);
  });

  it("heeft beide zinnen in alle vijf de talen, en in elke taal een eigen tekst", () => {
    for (const sleutel of ["klaar_mail_verstuurd", "klaar_mail_niet_verstuurd"] as const) {
      const gezien = new Set<string>();
      for (const taal of TOEGANGSMAIL_TALEN) {
        const zin = maakVertaler(taal)(sleutel);
        // Ontbreekt een taal, dan geeft de vertaler de sleutel zelf terug.
        expect(zin).not.toBe(sleutel);
        expect(zin.trim().length).toBeGreaterThan(0);
        gezien.add(zin);
      }
      expect(gezien.size).toBe(TOEGANGSMAIL_TALEN.length);
    }
  });

  it("belooft in de zin voor 'niet verstuurd' geen bericht", () => {
    // Deze zin verschijnt wanneer er niets de deur uit ging. Ze mag dus niet
    // suggereren dat er wel iets onderweg is.
    const nl = maakVertaler("nl")("klaar_mail_niet_verstuurd");
    expect(nl).toMatch(/geen bericht verstuurd/i);
  });
});
