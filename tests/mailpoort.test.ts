// ---------------------------------------------------------------------------
// tests/mailpoort.test.ts  -  de keuring van de verzendweg, de ontvangers en de batch
//
// AANLEIDING. Er werd een batch van drie uitnodigingen aangemaakt. Het scherm
// meldde drie keer "ok" in het groen, er gingen drie credits af, en er kwam bij
// niemand een bericht aan. De oorzaak lag niet in de verzendcode maar in de orde
// van de handelingen: er werd eerst aangemaakt en pas daarna verstuurd, en de
// uitkomst van dat versturen kwam nergens in het oordeel over de batch terecht.
//
// Deze toetsen leggen de nieuwe orde vast. Ze raken geen netwerk aan: de
// keuringsfuncties zijn met opzet zuiver, zodat het antwoord van de leverancier
// hier gewoon als gegeven ingevuld wordt. Wat de leverancier werkelijk antwoordt,
// bewijst geen toets maar de proefknop in het beheerscherm.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import {
  beoordeelBatch,
  beoordeelOntvanger,
  beoordeelWeg,
  isTijdelijkeFout,
  leesTegoed,
} from "../server/mailpoort/keuring";

const AFZENDER = "info@tapascity.com";

function account(inhoud: any) {
  return { ok: true as const, inhoud, status: 200 };
}
function afzenders(lijst: Array<{ email: string; active?: boolean }>) {
  return { ok: true as const, inhoud: { senders: lijst }, status: 200 };
}

describe("de verzendweg keuren", () => {
  it("noemt de weg onbruikbaar wanneer er niets is ingesteld", () => {
    const k = beoordeelWeg({ sleutelAanwezig: false, smtpAanwezig: false, gevraagdeAfzender: AFZENDER });
    expect(k.weg).toBe("geen");
    expect(k.bruikbaar).toBe(false);
    // Dit is het geval van de drie verloren uitnodigingen. De keuring zegt nu
    // zowel wat er schort als wat eraan helpt.
    expect(k.bezwaren.join(" ")).toContain("geen verzendweg");
    expect(k.wathelpt.join(" ")).toContain("BREVO_API_KEY");
  });

  it("laat de mailserverweg door zolang er een host staat", () => {
    const k = beoordeelWeg({ sleutelAanwezig: false, smtpAanwezig: true, gevraagdeAfzender: AFZENDER });
    expect(k.weg).toBe("smtp");
    expect(k.bruikbaar).toBe(true);
    expect(k.bezwaren).toEqual([]);
  });

  it("sluit de weg wanneer de leverancier de sleutel weigert", () => {
    const k = beoordeelWeg({
      sleutelAanwezig: true,
      smtpAanwezig: false,
      gevraagdeAfzender: AFZENDER,
      account: { ok: false, inhoud: undefined, status: 401, melding: "unauthorized" },
    });
    expect(k.bruikbaar).toBe(false);
    expect(k.bezwaren.join(" ")).toContain("weigert de sleutel");
  });

  it("laat de weg open wanneer de sleutel klopt en de afzender gevalideerd is", () => {
    const k = beoordeelWeg({
      sleutelAanwezig: true,
      smtpAanwezig: false,
      gevraagdeAfzender: AFZENDER,
      account: account({ plan: [{ type: "free", creditsType: "sendLimit", credits: 280 }] }),
      afzenders: afzenders([{ email: AFZENDER }]),
    });
    expect(k.bruikbaar).toBe(true);
    expect(k.afzenderStand).toBe("gevalideerd");
    expect(k.werkelijkeAfzender).toBe(AFZENDER);
    expect(k.resterendTegoed).toBe(280);
  });

  it("wijkt uit naar een gevalideerde afzender wanneer de gevraagde het niet is", () => {
    const k = beoordeelWeg({
      sleutelAanwezig: true,
      smtpAanwezig: false,
      gevraagdeAfzender: "TaPasCity <geen.validatie@tapascity.com>",
      account: account({ plan: [{ type: "free", creditsType: "sendLimit", credits: 300 }] }),
      afzenders: afzenders([{ email: "marc@tapascity.com" }]),
    });
    // De batch mag doorgaan, want er vertrekt werkelijk iets, maar het bezwaar
    // staat erbij: anders blijft het onverklaarbaar dat de afzender anders is.
    expect(k.bruikbaar).toBe(true);
    expect(k.afzenderStand).toBe("niet gevalideerd");
    expect(k.werkelijkeAfzender).toBe("marc@tapascity.com");
    expect(k.bezwaren.join(" ")).toContain("niet gevalideerd");
  });

  it("sluit de weg wanneer geen enkele afzender gevalideerd is", () => {
    const k = beoordeelWeg({
      sleutelAanwezig: true,
      smtpAanwezig: false,
      gevraagdeAfzender: AFZENDER,
      account: account({ plan: [{ type: "free", creditsType: "sendLimit", credits: 300 }] }),
      afzenders: afzenders([{ email: "oud@elders.be", active: false }]),
    });
    expect(k.bruikbaar).toBe(false);
    expect(k.geldigeAfzenders).toEqual([]);
  });

  it("sluit de weg wanneer het tegoed op is", () => {
    const k = beoordeelWeg({
      sleutelAanwezig: true,
      smtpAanwezig: false,
      gevraagdeAfzender: AFZENDER,
      account: account({ plan: [{ type: "free", creditsType: "sendLimit", credits: 0 }] }),
      afzenders: afzenders([{ email: AFZENDER }]),
    });
    expect(k.bruikbaar).toBe(false);
    expect(k.resterendTegoed).toBe(0);
    expect(k.bezwaren.join(" ")).toContain("tegoed");
  });

  it("leest het tegoed van het dagpakket en laat een onbekend pakket met rust", () => {
    expect(leesTegoed({ plan: [{ type: "free", creditsType: "sendLimit", credits: 12 }] } as any)).toBe(12);
    expect(leesTegoed(undefined)).toBe(null);
    expect(leesTegoed({} as any)).toBe(null);
    // Een abonnement zonder tellend tegoed geeft geen getal, en dat is geen bezwaar.
    expect(leesTegoed({ plan: [{ type: "subscription", creditsType: "unknown", credits: 5 }] } as any)).toBe(null);
  });
});

describe("de ontvangers keuren", () => {
  it("houdt een geblokkeerd adres tegen en zegt sinds wanneer", () => {
    const k = beoordeelOntvanger("herman@voorbeeld.be", {
      ok: true,
      status: 200,
      inhoud: { email: "herman@voorbeeld.be", reason: { code: "hardBounce", message: "hard bounce" }, blockedAt: "2026-09-12T10:00:00Z" },
    });
    expect(k.bruikbaar).toBe(false);
    expect(k.geblokkeerd).toBe(true);
    expect(k.bezwaar).toContain("2026-09-12");
    // Dit is de stille mislukking: aanvaard en niet bezorgd.
    expect(k.bezwaar).toContain("niet bezorgd");
  });

  it("laat een adres door dat niet op de lijst staat", () => {
    const k = beoordeelOntvanger("andrea@voorbeeld.be", { ok: true, status: 404, inhoud: null });
    expect(k.bruikbaar).toBe(true);
    expect(k.geblokkeerd).toBe(false);
    expect(k.vastgesteld).toBe(true);
  });

  it("houdt niemand tegen wanneer de leverancier het niet kon zeggen", () => {
    const k = beoordeelOntvanger("marc@tapascity.com", { ok: false, status: 0, inhoud: null, melding: "niet bereikbaar" });
    expect(k.bruikbaar).toBe(true);
    expect(k.vastgesteld).toBe(false);
  });

  it("weigert een adres dat geen adres is, zonder de leverancier te vragen", () => {
    const k = beoordeelOntvanger("herman.van.esbroeck", null);
    expect(k.bruikbaar).toBe(false);
    expect(k.bezwaar).toContain("geen geldig e-mailadres");
  });
});

describe("herkansen alleen bij een tijdelijke fout", () => {
  it("herkanst bij een snelheidsgrens, een storing en een verbinding die wegvalt", () => {
    expect(isTijdelijkeFout(429)).toBe(true);
    expect(isTijdelijkeFout(503)).toBe(true);
    expect(isTijdelijkeFout(0, "fetch aborted")).toBe(true);
    expect(isTijdelijkeFout(-1, "ETIMEDOUT")).toBe(true);
  });

  it("herkanst niet bij een geweigerde sleutel of afzender", () => {
    expect(isTijdelijkeFout(401, "unauthorized")).toBe(false);
    expect(isTijdelijkeFout(400, "Sender is invalid")).toBe(false);
    expect(isTijdelijkeFout(-1, "de server weigerde het adres")).toBe(false);
  });
});

describe("het oordeel over de batch", () => {
  it("noemt de batch van drie uitnodigingen zonder verzending niet geslaagd", () => {
    // Precies het geval van 12 september: drie rijen ok, geen enkel bericht weg.
    const oordeel = beoordeelBatch([
      { status: "ok", mailStatus: "gesimuleerd" },
      { status: "ok", mailStatus: "gesimuleerd" },
      { status: "ok", mailStatus: "gesimuleerd" },
    ]);
    expect(oordeel.aantalVerstuurd).toBe(0);
    expect(oordeel.aantalZonderMail).toBe(3);
    expect(oordeel.geslaagd).toBe(false);
    expect(oordeel.alarm).toContain("geen verzendweg ingesteld");
  });

  it("slaat alarm wanneer een deel van de berichten niet vertrok", () => {
    const oordeel = beoordeelBatch([
      { status: "ok", mailStatus: "verstuurd" },
      { status: "ok", mailStatus: "fout" },
    ]);
    expect(oordeel.aantalVerstuurd).toBe(1);
    expect(oordeel.geslaagd).toBe(false);
    expect(oordeel.alarm).toContain("vertrok niet");
  });

  it("noemt de batch geslaagd wanneer elk bericht vertrok", () => {
    const oordeel = beoordeelBatch([
      { status: "ok", mailStatus: "verstuurd" },
      { status: "ok", mailStatus: "verstuurd" },
    ]);
    expect(oordeel.geslaagd).toBe(true);
    expect(oordeel.alarm).toBe(null);
  });

  it("rekent een rij zonder adres niet als mislukking aan", () => {
    const oordeel = beoordeelBatch([
      { status: "ok", mailStatus: "verstuurd" },
      { status: "ok", mailStatus: "-" },
    ]);
    expect(oordeel.aantalZonderMail).toBe(0);
    expect(oordeel.geslaagd).toBe(true);
  });

  it("noemt een batch met een foute rij niet geslaagd", () => {
    const oordeel = beoordeelBatch([
      { status: "ok", mailStatus: "verstuurd" },
      { status: "fout", mailStatus: "-" },
    ]);
    expect(oordeel.geslaagd).toBe(false);
  });
});
