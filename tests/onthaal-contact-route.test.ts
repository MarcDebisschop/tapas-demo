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
  CONTACT_BEWAARMAANDEN,
  bewaartotVoorContact,
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

  it("gebruikt dezelfde standen en dezelfde verzendwegen als de bestaande mails", () => {
    // De stand "verstuurd" wordt hier niet zelf geschreven. Ze komt uit de
    // verzendweg, die het antwoord van de mailserver beoordeelt. Een eigen
    // literal "verstuurd" in dit blok zou juist de oude fout terugbrengen: een
    // bericht als bezorgd melden zonder dat de server het aanvaardde.
    const begin = mailerBron.indexOf("export async function verstuurBericht");
    const blok = mailerBron.slice(begin);
    expect(blok).toContain('status: "gesimuleerd"');
    expect(blok).toContain("isSimulatiemodus()");
    expect(blok).not.toContain('status: "verstuurd"');
    // De twee werkelijke wegen liggen sinds de mailpoort in naarBuiten, waar ze
    // voor elk bericht dezelfde zijn. Deze functie kiest ze dus niet zelf meer,
    // en dat is precies de bedoeling: een verbetering aan die ene plaats geldt
    // meteen voor elk bericht dat het platform stuurt.
    expect(blok).toContain('naarBuiten("bericht"');
    const gedeeld = mailerBron.slice(mailerBron.indexOf("async function naarBuiten"));
    expect(gedeeld).toContain("verstuurViaSmtp(");
    expect(gedeeld).toContain("verstuurViaBrevoApi(");
    expect(gedeeld).toContain("brevoApiGeconfigureerd()");
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

// ---------------------------------------------------------------------------
// F. Toestemming en bewaartermijn (bevinding 15 uit het privacydossier)
//
// Wat er eerder gemeten werd: het formulier vroeg naam, e-mailadres, organisatie,
// rol en een vrij tekstveld, en bewaarde dat zonder toestemmingsvinkje, zonder
// informatie aan de bezoeker en zonder enige termijn. Die drie gaten zijn nu
// gedicht; deze toetsen leggen dat vast.
// ---------------------------------------------------------------------------

const bewaarBron = readFileSync(
  resolve(__dirname, "../server/onthaal-contact-bewaartermijn.ts"),
  "utf8",
);
const jobBron = readFileSync(resolve(__dirname, "../server/bewaartermijn-job.ts"), "utf8");
const paginaBron = readFileSync(resolve(__dirname, "../client/src/pages/onthaal.tsx"), "utf8");
const tekstenBron = readFileSync(
  resolve(__dirname, "../client/src/publiek/teksten-onthaal.ts"),
  "utf8",
);

describe("F. Toestemming en bewaartermijn", () => {
  it("de route weigert een aanvraag zonder uitdrukkelijke toestemming", () => {
    expect(routeBron).toMatch(/if \(b\.toestemming !== true\)/);
    expect(routeBron).toMatch(/return res\.status\(400\)\.json\(\{\s*error:/);
  });

  it("het bewijs van de toestemming gaat mee de opslag in", () => {
    for (const kolom of [
      "toestemming",
      "toestemming_op",
      "verklaring_versie",
      "toestemming_ip",
      "bewaartot",
    ]) {
      expect(routeBron, `kolom ${kolom} hoort in de insert te staan`).toContain(kolom);
    }
    expect(routeBron).toMatch(/PRIVACY_VERKLARING_VERSIE/);
  });

  it("de bewaartermijn is twaalf maanden en wordt bij het opslaan gezet", () => {
    expect(CONTACT_BEWAARMAANDEN).toBe(12);
    const nu = new Date("2026-01-01T00:00:00.000Z");
    const tot = new Date(bewaartotVoorContact(nu));
    const maanden = (tot.getTime() - nu.getTime()) / (30 * 24 * 3600 * 1000);
    expect(Math.round(maanden)).toBe(12);
    expect(routeBron).toMatch(/bewaartotVoorContact\(\)/);
  });

  it("de opruiming wist de inhoud en houdt enkel de vaststelling over", () => {
    expect(bewaarBron).toMatch(/export function ruimVerstrekenContactaanvragenOp/);
    expect(bewaarBron).toMatch(/naam = '', organisatie = '', email = '', rol = '', vraag = ''/);
    expect(bewaarBron).toMatch(/toestemming_ip = NULL/);
    expect(bewaarBron).toMatch(/geanonimiseerd_op IS NULL/);
    expect(bewaarBron).toMatch(/actie: "contactaanvraag_anonimisering"/);
  });

  it("de opruiming draait mee in de dagelijkse bewaartermijnronde", () => {
    expect(jobBron).toMatch(
      /import \{ ruimVerstrekenContactaanvragenOp \} from "\.\/onthaal-contact-bewaartermijn"/,
    );
    expect(jobBron).toMatch(/ruimVerstrekenContactaanvragenOp\(\)/);
  });

  it("de pagina vraagt het vinkje, leeg bij het begin, en stuurt het mee", () => {
    expect(paginaBron).toMatch(/useState\(false\)/);
    expect(paginaBron).toContain('data-testid="onthaal-toestemming"');
    expect(paginaBron).toMatch(/if \(!toestemming\) \{/);
    expect(paginaBron).toMatch(/toestemming: true,/);
    // Na een gelukte verzending staat het vinkje weer leeg.
    expect(paginaBron).toMatch(/setToestemming\(false\)/);
  });

  it("de bezoeker leest in beide talen wat er met zijn gegevens gebeurt", () => {
    expect(paginaBron).toContain('data-testid="onthaal-privacyluik"');
    for (const sleutel of ["privacyKop", "privacyTekst", "toestemmingLabel", "foutToestemming"]) {
      expect(tekstenBron, `tekst ${sleutel} ontbreekt`).toContain(`${sleutel}: {`);
    }
    // De kern van artikel 13: wie, waarvoor, hoe lang, en hoe je het laat wissen.
    expect(tekstenBron).toMatch(/TaPasCity, Zandstraat 85, 2110 Wijnegem/);
    expect(tekstenBron).toMatch(/twaalf maanden/);
    expect(tekstenBron).toMatch(/twelve months/);
    expect(tekstenBron).toMatch(/info@tapascity\.com/);
  });
});
