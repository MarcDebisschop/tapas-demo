// ---------------------------------------------------------------------------
// server/mailpoort/routes.ts
//
// registerMailpoortRoutes(app): de beheerwegen van de mailpoort.
//
//   GET  /api/admin/mailpoort/diagnose     staat de deur open, en van wie mag hij komen
//   POST /api/admin/mailpoort/ontvangers   blokkeert de leverancier deze adressen
//   POST /api/admin/mailpoort/proef        verstuur nu een proefbericht en toon het bewijs
//   POST /api/admin/mailpoort/deblokkeer   haal een blokkering weg
//
// WAAROM DE PROEF EEN EIGEN WEG IS. Een belofte over bezorging is pas een bewijs
// wanneer iemand ze op dit moment kan navertellen. Toetsen bewijzen dat de code
// doet wat ze zegt; zij bewijzen niet dat de sleutel in deze omgeving werkt en
// dat de afzender bij de leverancier gevalideerd is. Daarvoor moet er werkelijk
// een bericht vertrekken, met het kenmerk van de leverancier erbij. Die knop
// staat in het beheerscherm en is zo vaak te gebruiken als nodig.
//
// De proef gaat bewust naar een adres dat de beheerder zelf invult, en het
// bericht draagt geen enkele persoonlijke link. Zo is de proef ongevaarlijk en
// toch echt.
// ---------------------------------------------------------------------------
import type { Express, Request, Response } from "express";
import { adminIdVanSessie, vereisAdmin } from "../admin-guard";
import { schrijfAuditLog } from "../audit-log";
import { verstuurBericht, isSimulatiemodus } from "../bulk-import/mailer";
import { deblokkeer } from "./brevo";
import { keurOntvangers, keurVerzendweg, vergeetKeuring } from "./poort";

const STANDAARD_AFZENDER = "info@tapascity.com";

function afzenderUitVerzoek(req: Request): string {
  const gevraagd = typeof req.query?.afzender === "string" ? req.query.afzender.trim() : "";
  if (gevraagd) return gevraagd;
  const body = typeof (req.body as any)?.afzender === "string" ? String((req.body as any).afzender).trim() : "";
  if (body) return body;
  if (process.env.SMTP_FROM && process.env.SMTP_FROM.trim()) return process.env.SMTP_FROM.trim();
  if (process.env.MAIL_FALLBACK_FROM && process.env.MAIL_FALLBACK_FROM.trim())
    return process.env.MAIL_FALLBACK_FROM.trim();
  return STANDAARD_AFZENDER;
}

function adressenUitVerzoek(ruw: unknown): string[] {
  if (!Array.isArray(ruw)) return [];
  return ruw
    .filter((e): e is string => typeof e === "string")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 200);
}

export function registerMailpoortRoutes(app: Express): void {
  // -------------------------------------------------------------------------
  // De stand van de verzendweg, nu.
  //
  // Geeft nooit de sleutel terug en nooit een deel ervan. Wat hier staat, mag in
  // een scherm: welke weg, of hij bruikbaar is, welke afzenders klaarstaan, en
  // wat er te doen valt.
  // -------------------------------------------------------------------------
  app.get("/api/admin/mailpoort/diagnose", vereisAdmin, async (req: Request, res: Response) => {
    const afzender = afzenderUitVerzoek(req);
    const vers = req.query?.vers === "1" || req.query?.vers === "true";
    try {
      const keuring = await keurVerzendweg(afzender, { vers });
      res.json({
        ...keuring,
        simulatiemodus: isSimulatiemodus(),
      });
    } catch (e) {
      res.status(500).json({
        error: "Het platform kon de stand van de verzendweg niet bepalen.",
        detail: e instanceof Error ? e.message : "onbekende fout",
      });
    }
  });

  // -------------------------------------------------------------------------
  // Blokkeert de leverancier een van deze adressen.
  //
  // Dit is de controle die het stille geval opvangt: een adres dat ooit
  // terugkwam of zich afmeldde, blijft aanvaard worden en wordt niet bezorgd.
  // -------------------------------------------------------------------------
  app.post("/api/admin/mailpoort/ontvangers", vereisAdmin, async (req: Request, res: Response) => {
    const adressen = adressenUitVerzoek((req.body as any)?.emails);
    if (adressen.length === 0) {
      return res.status(400).json({ error: "Geef minstens één e-mailadres mee in emails." });
    }
    try {
      const keuringen = await keurOntvangers(adressen);
      res.json({
        aantal: keuringen.length,
        aantalGeblokkeerd: keuringen.filter((k) => k.geblokkeerd).length,
        aantalOnvastgesteld: keuringen.filter((k) => !k.vastgesteld).length,
        keuringen,
      });
    } catch (e) {
      res.status(500).json({
        error: "Het platform kon de ontvangers niet nakijken.",
        detail: e instanceof Error ? e.message : "onbekende fout",
      });
    }
  });

  // -------------------------------------------------------------------------
  // Het proefbericht: het bewijs dat in deze omgeving werkelijk iets vertrekt.
  // -------------------------------------------------------------------------
  app.post("/api/admin/mailpoort/proef", vereisAdmin, async (req: Request, res: Response) => {
    const naar = typeof (req.body as any)?.naar === "string" ? String((req.body as any).naar).trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(naar)) {
      return res.status(400).json({ error: "Vul het e-mailadres in waar het proefbericht naartoe moet." });
    }
    const afzender = afzenderUitVerzoek(req);
    const stempel = new Date().toISOString().replace("T", " ").slice(0, 19);

    const keuring = await keurVerzendweg(afzender, { vers: true });
    const ontvanger = (await keurOntvangers([naar]))[0];

    const resultaat = await verstuurBericht({
      naar,
      naam: "beheerder",
      onderwerp: `Proefbericht TaPasCity, ${stempel}`,
      tekst:
        "Dit is een proefbericht van het TaPasCity-platform.\n\n" +
        `Verstuurd op ${stempel} (tijd van de server).\n` +
        `Weg naar buiten: ${keuring.weg}.\n` +
        `Afzender: ${keuring.werkelijkeAfzender}.\n\n` +
        "Komt dit bericht aan, dan werkt de verzendweg voor elk bericht dat het platform stuurt: " +
        "de uitnodiging, de herinnering, de aanmeldlink en de toegangsmail gaan dezelfde weg.\n\n" +
        "Staat dit bericht bij de ongewenste post, dan is het wel vertrokken, maar het komt niet in de map " +
        "waar de ontvanger kijkt. Meld het dan als gewenst en kijk de SPF- en DKIM-instellingen na.\n\n" +
        "TaPasCity",
    });

    void schrijfAuditLog({
      adminId: adminIdVanSessie(req),
      actie: "mailpoort_proef",
      afnameId: null,
      detail: `naar=${naar} weg=${keuring.weg} stand=${resultaat.status}`,
    });

    res.json({
      status: resultaat.status,
      melding: resultaat.melding ?? null,
      pogingen: resultaat.pogingen ?? 1,
      verstuurdOp: stempel,
      weg: keuring.weg,
      afzender: keuring.werkelijkeAfzender,
      keuring,
      ontvanger,
      // Het scherm mag geen bezorging beloven. Aanvaard door de leverancier is
      // niet hetzelfde als gelezen door de ontvanger, en alleen de ontvanger kan
      // dat laatste vaststellen.
      wat_nu:
        resultaat.status === "verstuurd"
          ? "De leverancier heeft het bericht aanvaard. Kijk in de postbus, ook bij de ongewenste post."
          : resultaat.status === "gesimuleerd"
            ? "Er is niets verstuurd: er staat geen verzendweg ingesteld."
            : "Er is niets vertrokken. De melding hierboven zegt waarom.",
    });
  });

  // -------------------------------------------------------------------------
  // Een blokkering weghalen.
  //
  // Alleen de hoofdbeheerder krijgt deze knop in het scherm, maar de weg zelf
  // staat achter dezelfde beheerderscontrole als de rest. De handeling gaat in
  // het auditlogboek: wie een blokkering weghaalt, zet de bescherming van een
  // ontvanger tegen ongewenste post opzij, en dat hoort navertelbaar te zijn.
  // -------------------------------------------------------------------------
  app.post("/api/admin/mailpoort/deblokkeer", vereisAdmin, async (req: Request, res: Response) => {
    const email = typeof (req.body as any)?.email === "string" ? String((req.body as any).email).trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return res.status(400).json({ error: "Vul een geldig e-mailadres in." });
    }
    const uitslag = await deblokkeer(email);
    vergeetKeuring();
    void schrijfAuditLog({
      adminId: adminIdVanSessie(req),
      actie: "mailpoort_deblokkeerd",
      afnameId: null,
      detail: `email=${email} ok=${uitslag.ok} status=${uitslag.status}`,
    });
    if (!uitslag.ok) {
      return res.status(502).json({
        error: uitslag.melding ?? "Het platform kon de blokkering niet weghalen.",
        status: uitslag.status,
      });
    }
    res.json({ ok: true, email, melding: "De blokkering is weggehaald. Berichten aan dit adres vertrekken weer." });
  });

  console.log("[tapas] Mailpoort-routes geregistreerd.");
}
