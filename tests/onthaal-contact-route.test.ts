// ---------------------------------------------------------------------------
// tests/onthaal-contact-route.test.ts
//
// Wat deze toetsen bewijzen:
//
//   A. Het bericht dat naar TaPasCity gaat, bevat alles wat een medewerker nodig
//      heeft om te antwoorden, en het antwoordadres is dat van de bezoeker.
//   B. Het doeladres is info@tapascity.com en staat vast in de code, niet in de
//      aanvraag van de bezoeker.
//   C. De route slaat eerst op en verstuurt daarna, en de verzendstatus gaat mee
//      in de opslag en in het antwoord. Een simulatie blijft dus zichtbaar.
//   D. De mailer heeft een echte, generieke verzendweg, met hetzelfde onderscheid
//      tussen verstuurd, gesimuleerd en fout als de bestaande mails.
//   E. De route staat geregistreerd in routes.ts.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ONTHAAL_DOEL_EMAIL,
  bouwOnthaalBericht,
  isGeldigEmail,
  MAX_VRAAG,
} from "../server/routes-onthaal-contact";

const routeBron = readFileSync(
  resolve(__dirname, "../server/routes-onthaal-contact.ts"),
  "utf8",
);
const routesBron = readFileSync(resolve(__dirname, "../server/routes.ts"), "utf8");
const mailerBron = readFileSync(resolve(__dirname, "../server/bulk-import/mailer.ts"), "utf8");

describe("A. Het bericht aan TaPasCity", () => {
  const vraag = {
    naam: "Els Peeters",
    organisatie: "Sint-Jozefinstituut",
    email: "els@school.be",
    rol: "Een school of onderwijsinstelling",
    vraag: "Wij willen T4Teens inzetten bij 120 leerlingen.",
  };

  it("noemt de vrager in het onderwerp", () => {
    const { onderwerp } = bouwOnthaalBericht(vraag);
    expect(onderwerp).toContain("Els Peeters");
    expect(onderwerp).toContain("Sint-Jozefinstituut");
  });

  it("bevat naam, organisatie, adres, rol en de vraag zelf", () => {
    const { tekst } = bouwOnthaalBericht(vraag);
    expect(tekst).toContain("Els Peeters");
    expect(tekst).toContain("Sint-Jozefinstituut");
    expect(tekst).toContain("els@school.be");
    expect(tekst).toContain("Een school of onderwijsinstelling");
    expect(tekst).toContain("Wij willen T4Teens inzetten bij 120 leerlingen.");
  });

  it("zegt eerlijk wanneer een veld niet is ingevuld", () => {
    const { tekst } = bouwOnthaalBericht({ ...vraag, organisatie: "", vraag: "" });
    expect(tekst).toContain("niet opgegeven");
    expect(tekst).toContain("(geen tekst ingevuld)");
  });

  it("zet het adres van de bezoeker als antwoordadres", () => {
    expect(routeBron).toMatch(/antwoordNaar:\s*vraagGegevens\.email/);
  });
});

describe("B. Het doeladres", () => {
  it("is info@tapascity.com", () => {
    expect(ONTHAAL_DOEL_EMAIL).toBe("info@tapascity.com");
  });

  it("komt niet uit de aanvraag van de bezoeker", () => {
    expect(routeBron).toMatch(/naar:\s*ONTHAAL_DOEL_EMAIL/);
    expect(routeBron).not.toMatch(/naar:\s*String\(b\./);
  });
});

describe("C. Opslaan, versturen, en de status meesturen", () => {
  it("slaat op vóór het versturen", () => {
    expect(routeBron.indexOf("INSERT INTO onthaal_contactaanvragen")).toBeLessThan(
      routeBron.indexOf("await verstuurBericht"),
    );
  });

  it("bewaart de verzendstatus bij de aanvraag", () => {
    expect(routeBron).toContain("mail_status");
    expect(routeBron).toMatch(/UPDATE onthaal_contactaanvragen SET mail_status/);
  });

  it("geeft de status en de simulatiestand mee in het antwoord", () => {
    expect(routeBron).toMatch(/mailStatus:\s*status/);
    expect(routeBron).toMatch(/gesimuleerd:\s*status === "gesimuleerd"/);
    expect(routeBron).toMatch(/simulatiemodus:\s*isSimulatiemodus\(\)/);
  });

  it("waarschuwt in het logboek wanneer de vraag niet werkelijk vertrok", () => {
    expect(routeBron).toMatch(/if \(status !== "verstuurd"\) \{\s*console\.warn/);
    expect(routeBron).toContain("Controleer BREVO_API_KEY of SMTP_HOST");
  });

  it("meldt geen succes wanneer er niets is opgeslagen en niets is verstuurd", () => {
    expect(routeBron).toMatch(/if \(!rijId && status !== "verstuurd"\)/);
    expect(routeBron).toMatch(/res\.status\(500\)/);
  });

  it("begrenst het aantal aanvragen per adres op vijf per kwartier", () => {
    expect(routeBron).toMatch(/RL_VENSTER_MS = 15 \* 60 \* 1000/);
    expect(routeBron).toMatch(/RL_MAX = 5/);
    expect(routeBron).toMatch(/res\s*\.status\(429\)/);
  });

  it("weigert een onzinnig adres en een te lange vraag", () => {
    expect(isGeldigEmail("els@school.be")).toBe(true);
    expect(isGeldigEmail("els(at)school")).toBe(false);
    expect(MAX_VRAAG).toBe(5000);
    expect(routeBron).toMatch(/vraagGegevens\.vraag\.length > MAX_VRAAG/);
  });
});

describe("D. De generieke verzendweg in de mailer", () => {
  it("bestaat en is uitgevoerd", () => {
    expect(mailerBron).toMatch(/export async function verstuurBericht/);
  });

  it("gebruikt dezelfde drie standen als de bestaande mails", () => {
    const begin = mailerBron.indexOf("export async function verstuurBericht");
    const blok = mailerBron.slice(begin);
    expect(blok).toContain('status: "gesimuleerd"');
    expect(blok).toContain('status: "verstuurd"');
    expect(blok).toContain('status: "fout"');
    expect(blok).toContain("isSimulatiemodus()");
    expect(blok).toContain("brevoApiGeconfigureerd()");
  });

  it("stuurt een antwoordadres mee wanneer dat er is", () => {
    expect(mailerBron).toMatch(/antwoordNaar\?: string \| null/);
    expect(mailerBron).toMatch(/replyTo: \{ email: args\.antwoordNaar\.trim\(\) \}/);
  });

  it("laat de bestaande drie verzendfuncties ongemoeid", () => {
    expect(mailerBron).toMatch(/export async function verstuurUitnodiging/);
    expect(mailerBron).toMatch(/export async function verstuurToegangsmail/);
    expect(mailerBron).toMatch(/export async function verstuurAanmeldlink/);
  });
});

describe("E. De registratie", () => {
  it("staat in routes.ts, naast het coachformulier", () => {
    expect(routesBron).toMatch(
      /import \{ registerOnthaalContactRoutes \} from "\.\/routes-onthaal-contact"/,
    );
    expect(routesBron).toMatch(/registerOnthaalContactRoutes\(app\)/);
  });

  it("de route zelf heet /api/onthaal-contact", () => {
    expect(routeBron).toMatch(/app\.post\("\/api\/onthaal-contact"/);
  });

  it("het overzicht voor de beheerder vraagt een aanmelding", () => {
    expect(routeBron).toMatch(/app\.get\("\/api\/admin\/onthaal-contactaanvragen"/);
    expect(routeBron).toMatch(/if \(!adminId\) return res\.status\(401\)/);
  });
});
