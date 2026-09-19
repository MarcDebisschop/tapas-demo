// =============================================================================
// server/bulk-import/routes.ts  -  NIEUW BESTAND (Werkprotocol Regel 2)
// -----------------------------------------------------------------------------
// registerBulkImportRoutes(app): admin-endpoints voor bulk-import via Excel/CSV.
//
//   GET  /api/admin/bulk-import/instrumenten            : ondersteunde instrumenten + velden
//   GET  /api/admin/bulk-import/template/:instrumentId  : download .xlsx-template
//   POST /api/admin/bulk-import/preview                 : parse + valideer (maakt niets aan)
//   POST /api/admin/bulk-import/verwerk                 : maak uitnodigingen + verstuur/queue mail
//
// De verwerk-stap HERGEBRUIKT de bestaande uitnodig-logica (saldo-check +
// storage.reserveer, 1 credit per uitnodiging), net als POST /api/uitnodigingen.
// De bestaande repo-functie maakUitnodiging wordt NIET gewijzigd; in plaats
// daarvan schrijft de nieuwe functie maakBulkUitnodiging hieronder direct via
// dezelfde Drizzle-tabel, additief uitgebreid met e-mail + instrumentId.
//
// Org-eigen afzender: opgeslagen in een APARTE kleine tabel org_mail_afzender
// (Regel 1/2, shared/schema.ts blijft ongewijzigd).
// =============================================================================

import type { Express, Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { storage, db, sqlite, CreditError } from "../storage";
import { vereisScope, scopeVanVerzoek, schrijfOrganisatieId, verzenderVanVerzoek } from "../scope-guard";
import { beoordeelSchrijfweg, weigeringslichaam } from "../bekwaamheid/poortbrug";
import { afnames, type Afname } from "@shared/schema";
import { getTemplate, alleTemplates, TEMPLATES } from "./templates";
import { templateAlsBuffer, parseUpload, type ParseFout } from "./excel";
import { verstuurUitnodiging, isSimulatiemodus, afzenderVoor } from "./mailer";
import { keurOntvangers, keurVerzendweg } from "../mailpoort/poort";
import { beoordeelBatch, type Ontvangerkeuring } from "../mailpoort/keuring";
import { poortVoorUitstuur } from "../t4students/uitstuurcontrole";
import { t4oStorage } from "../t4organizations/storage";
import { T4O_GROEPEN, type T4OGroep } from "../t4organizations/schema";

// ---------------------------------------------------------------------------
// Admin-sessiecheck (zelfde patroon als de rest van het platform).
// ---------------------------------------------------------------------------
function requireAdmin(req: Request, res: Response): boolean {
  const adminId = (req.session as any)?.adminId;
  if (!adminId) {
    res.status(401).json({ error: "Niet ingelogd." });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Prior-beheerdercheck (Werkprotocol Regel 2, additief).
// Gratis bulk-verzending ZONDER organisatie (geen credits) is voorbehouden aan
// de hoofdbeheerder (isPrior). Gewone admins moeten een organisatie kiezen
// zodat het bestaande credit-model geldt. Deze helper wijzigt niets aan de
// bestaande flow; ze levert enkel de isPrior-status van de ingelogde admin.
// ---------------------------------------------------------------------------
// Prior wordt centraal beslist in server/scope-guard.ts. De vroegere lokale
// versie hier keek enkel naar `isPrior` en niet naar de prior-organisatie, en
// was dus zwakker dan de rest van het platform.

// ---------------------------------------------------------------------------
// Org-eigen afzender-tabel (idempotent aangemaakt in de nieuwe module).
// ---------------------------------------------------------------------------
function zorgAfzenderTabel(): void {
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS org_mail_afzender (
        organisatie_id INTEGER PRIMARY KEY,
        afzender_email TEXT NOT NULL,
        bijgewerkt_op TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch (e) {
    console.error("[bulk-import] kon org_mail_afzender niet aanmaken:", e);
  }
}

function afzenderVoorOrg(organisatieId: number | null): string | null {
  if (organisatieId == null) return null;
  try {
    const rij = sqlite
      .prepare("SELECT afzender_email FROM org_mail_afzender WHERE organisatie_id = ?")
      .get(organisatieId) as { afzender_email: string } | undefined;
    return rij?.afzender_email ?? null;
  } catch {
    return null;
  }
}

function bewaarAfzenderVoorOrg(organisatieId: number, afzender: string): void {
  try {
    sqlite
      .prepare(
        `INSERT INTO org_mail_afzender (organisatie_id, afzender_email, bijgewerkt_op)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(organisatie_id) DO UPDATE SET afzender_email = excluded.afzender_email, bijgewerkt_op = excluded.bijgewerkt_op`,
      )
      .run(organisatieId, afzender);
  } catch (e) {
    console.error("[bulk-import] kon org-afzender niet bewaren:", e);
  }
}

// ---------------------------------------------------------------------------
// Nieuwe uitnodig-functie (bestaande maakUitnodiging blijft ONGEWIJZIGD).
// Schrijft additief e-mail (deelnemer_email) + instrument_id weg.
// ---------------------------------------------------------------------------
function bulkToken(len: number): string {
  return randomBytes(Math.ceil(len * 0.75))
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, len);
}

async function maakBulkUitnodiging(data: {
  organisatieId?: number | null;
  name?: string | null;
  company?: string | null;
  role?: string | null;
  taal?: string | null;
  email?: string | null;
  instrumentId?: string | null;
  aangemaaktDoorBeheerderId?: number | null;
  aangemaaktDoorOrganisatieId?: number | null;
}): Promise<Afname> {
  const now = new Date().toISOString();
  const token = `${bulkToken(8)}-${bulkToken(8)}-${bulkToken(8)}`;
  const tempCode = `INV-${Date.now()}-${bulkToken(4)}`;
  return db
    .insert(afnames)
    .values({
      organisatieId: data.organisatieId ?? null,
      respondentCode: tempCode,
      name: data.name && data.name.trim() ? data.name.trim() : "(nog niet ingevuld)",
      company: data.company ?? null,
      role: data.role ?? null,
      consentGiven: false,
      baselineEnergy: 5,
      taal: data.taal ?? "nl",
      aangemaaktDoorBeheerderId: data.aangemaaktDoorBeheerderId ?? null,
      aangemaaktDoorOrganisatieId: data.aangemaaktDoorOrganisatieId ?? null,
      status: "uitgenodigd",
      inviteToken: token,
      uitgenodigdAt: now,
      createdAt: now,
      deelnemerEmail: data.email ?? null,
      instrumentId: data.instrumentId ?? null,
    })
    .returning()
    .get();
}

// Idempotentie: bestaat er al een uitnodiging voor dit e-mail+instrument(+org)?
function bestaandeUitnodiging(email: string, instrumentId: string, organisatieId: number | null): Afname | undefined {
  try {
    if (organisatieId == null) {
      return sqlite
        .prepare(
          "SELECT * FROM afnames WHERE deelnemer_email = ? AND instrument_id = ? AND organisatie_id IS NULL LIMIT 1",
        )
        .get(email, instrumentId) as Afname | undefined;
    }
    return sqlite
      .prepare(
        "SELECT * FROM afnames WHERE deelnemer_email = ? AND instrument_id = ? AND organisatie_id = ? LIMIT 1",
      )
      .get(email, instrumentId, organisatieId) as Afname | undefined;
  } catch {
    return undefined;
  }
}

// Bouw de naam op uit voornaam + achternaam (of val terug op leeg).
function volledigeNaam(waarden: Record<string, string>): string {
  return [waarden.voornaam, waarden.achternaam].filter(Boolean).join(" ").trim();
}

// ---------------------------------------------------------------------------
// Linktype voor de uitnodigingsmail (additief, bestaand gedrag = default).
//   "vragenlijst" (default) → #/deelnemer/TOKEN   (vragenlijst starten/invullen)
//   "dashboard"             → /toegang.html?t=TOKEN (cijferslot-permalink,
//                              rechtstreeks naar het persoonlijke dashboard)
// De keuze komt uit req.body.linkType; onbekende/lege waarde valt terug op
// "vragenlijst", zodat bestaande bulk-imports exact hetzelfde blijven werken.
// ---------------------------------------------------------------------------
type LinkType = "vragenlijst" | "dashboard";

function leesLinkType(req: Request): LinkType {
  return req.body?.linkType === "dashboard" ? "dashboard" : "vragenlijst";
}

function bouwUitnodigingsLink(origin: string, token: string | null, linkType: LinkType): string {
  const t = token ?? "";
  if (linkType === "dashboard") {
    // Statische cijferslot-permalink; origin heeft geen trailing slash meer.
    return origin ? `${origin}/toegang.html?t=${t}` : `/toegang.html?t=${t}`;
  }
  return origin ? `${origin}#/deelnemer/${t}` : `#/deelnemer/${t}`;
}

// ---------------------------------------------------------------------------
// Bestandsinhoud uit de request halen (base64 in JSON-body).
// ---------------------------------------------------------------------------
function leesBestand(req: Request): Buffer | null {
  const b64 = req.body?.bestandBase64;
  if (typeof b64 === "string" && b64.length > 0) {
    // Ondersteun ook data-URI-prefix ("data:...;base64,....").
    const komma = b64.indexOf(",");
    const zuiver = b64.startsWith("data:") && komma >= 0 ? b64.slice(komma + 1) : b64;
    try {
      return Buffer.from(zuiver, "base64");
    } catch {
      return null;
    }
  }
  return null;
}

interface PreviewRij {
  rij: number;
  email: string;
  naam: string;
  taal: string;
  fout: boolean;
  meldingen: string[];
}

// Zet parse-resultaat om in een preview + geldige-rijen-lijst.
function bouwPreview(
  instrumentId: string,
  rijen: { rij: number; waarden: Record<string, string> }[],
  fouten: ParseFout[],
) {
  const foutPerRij = new Map<number, string[]>();
  for (const f of fouten) {
    if (f.rij === 0) continue;
    const lijst = foutPerRij.get(f.rij) ?? [];
    lijst.push(`${f.kolom ? f.kolom + ": " : ""}${f.melding}`);
    foutPerRij.set(f.rij, lijst);
  }
  const preview: PreviewRij[] = rijen.map((r) => {
    const meldingen = foutPerRij.get(r.rij) ?? [];
    return {
      rij: r.rij,
      email: r.waarden.email ?? "",
      naam: volledigeNaam(r.waarden) || "(geen naam)",
      taal: r.waarden.taal ?? "nl",
      fout: meldingen.length > 0,
      meldingen,
    };
  });
  return preview;
}

// ---------------------------------------------------------------------------
// T4O-verwerking: maakt één organisatie-afname (sessie) aan en per geldige rij
// een respondent in de juiste ring. Anoniem model: geen credits, geen afname-
// record; de deelnemer vult in via een persoonlijke #/t4o/r/:token-link.
// Mail wordt enkel verstuurd wanneer er een (optioneel) e-mailadres is.
// ---------------------------------------------------------------------------
async function verwerkT4O(
  req: Request,
  res: Response,
  titel: string,
  rijen: { rij: number; waarden: Record<string, string> }[],
  fouten: ParseFout[],
  origin: string,
): Promise<Response> {
  const foutRijen = new Set(fouten.filter((f) => f.rij > 0).map((f) => f.rij));

  // Organisatienaam voor de sessie: expliciete orgNaam wint, anders de
  // meegestuurde bestandsnaam, anders een datumgebaseerde fallback.
  const orgNaam =
    (typeof req.body?.orgNaam === "string" && req.body.orgNaam.trim()) ||
    (typeof req.body?.bestandsnaam === "string" && req.body.bestandsnaam.trim()) ||
    `Bulk-import ${new Date().toLocaleDateString("nl-BE")}`;
  const orgLabel = typeof req.body?.orgLabel === "string" ? req.body.orgLabel.trim() : "";

  const sessie = t4oStorage.maakSessie({ orgNaam, orgLabel });

  const resultaten: Array<{
    rij: number;
    email: string;
    status: "ok" | "fout";
    link: string | null;
    mailStatus: "verstuurd" | "gesimuleerd" | "fout" | "-";
    melding: string;
  }> = [];

  for (const r of rijen) {
    const email = r.waarden.email ?? "";
    if (foutRijen.has(r.rij)) {
      const meldingen = fouten.filter((f) => f.rij === r.rij).map((f) => `${f.kolom}: ${f.melding}`);
      resultaten.push({ rij: r.rij, email, status: "fout", link: null, mailStatus: "-", melding: meldingen.join(" | ") || "Ongeldige rij." });
      continue;
    }

    const groep = r.waarden.groep as T4OGroep;
    if (!T4O_GROEPEN.includes(groep)) {
      resultaten.push({ rij: r.rij, email, status: "fout", link: null, mailStatus: "-", melding: `Ongeldige ring/groep '${r.waarden.groep}'.` });
      continue;
    }

    const respondent = t4oStorage.maakRespondent(sessie.id, groep);
    const link = origin ? `${origin}#/t4o/r/${respondent.token}` : `#/t4o/r/${respondent.token}`;

    let mailStatus: "verstuurd" | "gesimuleerd" | "fout" | "-" = "-";
    let melding = "Respondent aangemaakt.";
    if (email) {
      const naam = volledigeNaam(r.waarden);
      const mail = await verstuurUitnodiging({ naar: email, taal: r.waarden.taal || "nl", naam, link, instrument: titel, from: null });
      mailStatus = mail.status;
      melding = mail.melding ?? (mail.gesimuleerd ? "De mail is alleen nagebootst (SMTP staat niet ingesteld)." : "Uitnodiging verstuurd.");
    }

    resultaten.push({ rij: r.rij, email, status: "ok", link, mailStatus, melding });
  }

  const oordeel = beoordeelBatch(resultaten);
  const aantalOk = resultaten.filter((r) => r.status === "ok").length;
  return res.json({
    instrumentId: "t4o",
    aantalMailVerstuurd: oordeel.aantalVerstuurd,
    aantalZonderMail: oordeel.aantalZonderMail,
    geslaagd: oordeel.geslaagd,
    mailAlarm: oordeel.alarm,
    simulatiemodus: isSimulatiemodus(),
    sessieId: sessie.id,
    sessieLink: origin ? `${origin}#/t4o/sessie/${sessie.id}` : `#/t4o/sessie/${sessie.id}`,
    totaal: rijen.length,
    aantalOk,
    aantalOvergeslagen: 0,
    aantalFout: resultaten.filter((r) => r.status === "fout").length,
    resultaten,
  });
}

// ===========================================================================
export function registerBulkImportRoutes(app: Express): void {
  zorgAfzenderTabel();

  // --- Lijst van ondersteunde instrumenten + velddefinities (voor de UI) ---
  app.get("/api/admin/bulk-import/instrumenten", (req, res) => {
    if (!requireAdmin(req, res)) return;
    res.json({
      simulatiemodus: isSimulatiemodus(),
      instrumenten: alleTemplates().map((t) => ({
        instrumentId: t.instrumentId,
        titel: t.titel,
        instructie: t.instructie,
        velden: t.velden.map((v) => ({ kolom: v.kolom, verplicht: v.verplicht, hint: v.hint })),
      })),
    });
  });

  // --- Download .xlsx-template voor één instrument (admin, niet publiek) ---
  app.get("/api/admin/bulk-import/template/:instrumentId", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const tpl = getTemplate(req.params.instrumentId);
    if (!tpl) return res.status(404).json({ error: "Onbekend instrument." });
    const buffer = await templateAlsBuffer(tpl);
    const bestandsnaam = `bulk-import_${tpl.instrumentId}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${bestandsnaam}"`);
    res.send(buffer);
  });

  // --- Preview: parse + valideer, maak NIETS aan ---
  app.post("/api/admin/bulk-import/preview", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const instrumentId = String(req.body?.instrumentId ?? "");
    const tpl = getTemplate(instrumentId);
    if (!tpl) return res.status(400).json({ error: "Dit instrument bestaat niet of het platform ondersteunt het niet." });

    const bestand = leesBestand(req);
    if (!bestand) return res.status(400).json({ error: "Het platform heeft geen bestand ontvangen (bestandBase64 ontbreekt)." });

    const { rijen, fouten } = await parseUpload(bestand, tpl);
    const kopFout = fouten.find((f) => f.rij === 0);
    if (kopFout) {
      return res.status(422).json({
        error: "De kolomkoppen komen niet overeen met het sjabloon.",
        fouten,
      });
    }
    const preview = bouwPreview(instrumentId, rijen, fouten);
    const aantalGeldig = preview.filter((p) => !p.fout).length;
    res.json({
      instrumentId,
      titel: tpl.titel,
      totaal: preview.length,
      aantalGeldig,
      aantalFout: preview.length - aantalGeldig,
      preview,
      fouten,
    });
  });

  // --- Verwerk: maak uitnodigingen aan + verstuur/queue mail ---
  app.post("/api/admin/bulk-import/verwerk", vereisScope, async (req, res) => {
    const instrumentId = String(req.body?.instrumentId ?? "");
    const tpl = getTemplate(instrumentId);
    if (!tpl) return res.status(400).json({ error: "Dit instrument bestaat niet of het platform ondersteunt het niet." });

    // Uitstuurcontrole van het studiekompas, dezelfde poort als op
    // /api/afnames en /api/uitnodigingen. Een bulkverzending is de deur waar de
    // meeste uitnodigingen tegelijk buiten gaan, dus de poort hoort hier zeker
    // te hangen. Zie server/t4students/uitstuurcontrole.ts. Andere instrumenten
    // gaan ongewijzigd door.
    const uitstuurBulk = await poortVoorUitstuur(instrumentId, app);
    if (uitstuurBulk) {
      return res.status(uitstuurBulk.status).json(uitstuurBulk.lichaam);
    }

    // De organisatie komt uit de scope. Een organisatie die een ander id
    // meestuurt krijgt 403; anders zou ze in bulk uitnodigingen op kosten van
    // een andere organisatie kunnen versturen.
    const gevraagd =
      req.body?.organisatieId != null && Number.isFinite(Number(req.body.organisatieId))
        ? Number(req.body.organisatieId)
        : null;
    const scope = scopeVanVerzoek(req);
    const keuze = schrijfOrganisatieId(scope, gevraagd);
    if (!keuze.ok) return res.status(403).json({ error: keuze.fout });
    const organisatieId: number | null = keuze.organisatieId;
    // Een keer bepaald voor de hele import; elke rij krijgt dezelfde verzender.
    const verzender = await verzenderVanVerzoek(req);

    // Gratis verzending ZONDER organisatie kost geen credits en blijft
    // voorbehouden aan de prior. Een organisatie-scope levert hier altijd een
    // organisatieId op, dus deze tak raakt enkel de prior die er zelf geen
    // koos.
    if (organisatieId == null && scope.soort !== "prior") {
      return res.status(403).json({
        error:
          "Alleen de hoofdbeheerder mag gratis versturen zonder organisatie. " +
          "Kies een organisatie, dan verrekent het platform de credits. Of vraag het aan de hoofdbeheerder.",
        code: "ENKEL_PRIOR_GRATIS",
      });
    }

    // Optionele org-eigen afzender (override). Wordt bewaard voor hergebruik.
    const afzenderOverride: string | null =
      typeof req.body?.afzenderEmail === "string" && req.body.afzenderEmail.trim()
        ? req.body.afzenderEmail.trim()
        : null;
    if (organisatieId != null && afzenderOverride) {
      bewaarAfzenderVoorOrg(organisatieId, afzenderOverride);
    }
    const afzender = afzenderOverride ?? afzenderVoorOrg(organisatieId);

    const bestand = leesBestand(req);
    if (!bestand) return res.status(400).json({ error: "Het platform heeft geen bestand ontvangen (bestandBase64 ontbreekt)." });

    const { rijen, fouten } = await parseUpload(bestand, tpl);
    const kopFout = fouten.find((f) => f.rij === 0);
    if (kopFout) {
      return res.status(422).json({ error: "De kolomkoppen komen niet overeen met het sjabloon.", fouten });
    }

    // -----------------------------------------------------------------------
    // DE MAILPOORT, vóór er iets wordt aangemaakt.
    //
    // AANLEIDING. Een batch van drie uitnodigingen werd aangemaakt, drie credits
    // gingen eraf, het scherm meldde "3 aangemaakt" in het groen, en er vertrok
    // geen enkel bericht. De reden stond wel in een kolom verderop, maar een
    // groene kop leest iedereen en een kolom verderop leest niemand. Wie op dat
    // bericht wachtte, wachtte voor niets.
    //
    // Sindsdien geldt de omgekeerde orde: eerst vragen of de deur open staat,
    // dan pas aanmaken. Staat de deur dicht, dan wordt er niets aangemaakt en
    // niets gereserveerd, en zegt het antwoord wat eraan schort en wat helpt.
    // Wie toch alleen de links wil, stuurt tochAanmaken mee: dan is het een
    // keuze en geen verrassing.
    //
    // De keuring gaat met vers op true. Een verzender die net een sleutel zette,
    // mag niet op een oordeel van een minuut geleden blijven hangen.
    // -----------------------------------------------------------------------
    let afzenderNaarBuiten = afzenderVoor(afzender);
    const tochAanmaken = req.body?.tochAanmaken === true;

    // AANLEIDING. Een uitnodiging die al bestond werd overgeslagen, en daarmee
    // kreeg de deelnemer ook geen bericht. Dat gaat goed zolang het eerste
    // bericht vertrok. Vertrok het niet, omdat de afzender bij de leverancier
    // nog niet gevalideerd was, dan zat de uitnodiging vast: aanmaken kon niet
    // meer, want ze bestond, en versturen deed het scherm niet. De beheerder
    // moest de link met de hand uit de tabel halen.
    //
    // Staat herverstuur aan, dan stuurt de invoer het bericht opnieuw naar de
    // bestaande link. Er komt geen tweede uitnodiging en er gaat geen tweede
    // credit af: het is hetzelfde token, enkel de weg naar buiten wordt
    // opnieuw gelopen. Standaard staat de schakelaar uit, zodat een gewone
    // invoer niemand tweemaal aanschrijft.
    const herverstuur = req.body?.herverstuur === true;
    let mailKeuring = await keurVerzendweg(afzenderNaarBuiten, { vers: true });

    // TERUGVAL OP DE AFZENDER VAN HET PLATFORM.
    //
    // AANLEIDING. Een afzender die eens getypt werd, blijft voor die organisatie
    // bewaard en wordt bij elke latere batch opnieuw gebruikt. Wordt dat adres
    // later bij de leverancier niet meer erkend, dan blijft elke batch van die
    // organisatie stilvallen op een adres dat niemand nog voor ogen had, terwijl
    // het adres van het platform zelf wel erkend is.
    //
    // Daarom: is de bewaarde afzender onbruikbaar en het adres van het platform
    // wel, dan vertrekt het bericht vanaf dat laatste. Het antwoord zegt met
    // welk adres er werkelijk verstuurd is, zodat de terugval te zien is en
    // niet stil gebeurt.
    let afzenderTeruggevallen: { van: string; naar: string } | null = null;
    if (!mailKeuring.bruikbaar) {
      const platformAfzender = afzenderVoor(null);
      if (platformAfzender !== afzenderNaarBuiten) {
        const tweede = await keurVerzendweg(platformAfzender, { vers: true });
        if (tweede.bruikbaar) {
          afzenderTeruggevallen = { van: afzenderNaarBuiten, naar: platformAfzender };
          afzenderNaarBuiten = platformAfzender;
          mailKeuring = tweede;
        }
      }
    }
    if (!mailKeuring.bruikbaar && !tochAanmaken) {
      return res.status(409).json({
        error:
          "Er kan nu geen enkel bericht vertrekken. Er is dus niets aangemaakt en u betaalt geen credits. " +
          mailKeuring.bezwaren.join(" "),
        code: "MAILWEG_ONBRUIKBAAR",
        keuring: mailKeuring,
        // Met dit veld in het verzoek maakt de verzender bewust alleen de links
        // aan, om ze zelf door te geven.
        hoeToch: "Stuur tochAanmaken mee als je alleen de links wilt aanmaken, zonder te versturen.",
      });
    }

    // De blokkeerlijst van de leverancier. Dit is het enige geval waarin een
    // bericht aanvaard wordt en nooit aankomt, en dus het enige dat vóór het
    // aanmaken thuishoort.
    const ontvangerKeuringen = await keurOntvangers(
      rijen.map((r) => r.waarden.email ?? "").filter(Boolean),
    );
    const geblokkeerdeAdressen = new Map<string, Ontvangerkeuring>(
      ontvangerKeuringen.filter((k) => !k.bruikbaar).map((k) => [k.email, k]),
    );

    // -----------------------------------------------------------------------
    // T4O-organisatiescan: eigen verwerking (geen afname/credit-model). Elke
    // rij wordt een respondent in één nieuwe organisatie-afname; de ring komt
    // uit de kolom 'Ring/Groep'. Retourneert persoonlijke #/t4o/r/:token-links.
    // -----------------------------------------------------------------------
    if (instrumentId === "t4o") {
      const t4oOrigin = typeof req.body?.origin === "string" ? req.body.origin.replace(/\/+$/, "") : "";
      return verwerkT4O(req, res, tpl.titel, rijen, fouten, t4oOrigin);
    }

    // Bekwaamheidspoort. Eén oordeel voor de hele import, niet één per rij: bij
    // een bulkverzending is de licentievraag één vraag, namelijk of deze persoon dit
    // instrument mag afnemen, en die verandert niet halverwege het bestand. Per rij
    // toetsen zou honderden identieke opzoekingen doen en, erger, honderden
    // identieke auditregels schrijven voor één handeling.
    //
    // Staat ná de T4O-aftakking hierboven en niet ervoor. T4O schrijft niet naar
    // `afnames` maar naar `t4o_sessies`; dat is een eigen schrijfweg die in de
    // inventarisatie van blok 2 apart is vastgelegd en in een latere ronde aan de
    // beurt komt. Hem hier meenemen zou de poort laten oordelen over een pad dat
    // niet onderzocht is.
    //
    // Staat vóór de saldo-check, zoals op de andere twee wegen: een licentievraag
    // hoort niet als creditsfout te verschijnen.
    const poortoordeel = await beoordeelSchrijfweg({
      handeling: "uitnodiging_aanmaken",
      instrumentId,
      verzender,
    });
    if (!poortoordeel.mag) {
      return res.status(403).json(weigeringslichaam(poortoordeel));
    }

    // Bepaal geldige rijen (rijen zonder validatiefout).
    const foutRijen = new Set(fouten.filter((f) => f.rij > 0).map((f) => f.rij));
    const geldigeRijen = rijen.filter((r) => !foutRijen.has(r.rij));

    // Saldo-check voor de HELE batch (som van geldige rijen ≤ beschikbaar saldo).
    if (organisatieId != null) {
      const org = await storage.getOrganisatie(organisatieId);
      if (!org) return res.status(404).json({ error: "Organisatie niet gevonden" });
      const saldo = await storage.getSaldo(organisatieId);
      if (saldo.beschikbaar < geldigeRijen.length) {
        return res.status(402).json({
          error: `Onvoldoende credits: ${geldigeRijen.length} uitnodigingen nodig, ${saldo.beschikbaar} beschikbaar. Laad credits op.`,
          code: "GEEN_CREDITS",
          benodigd: geldigeRijen.length,
          beschikbaar: saldo.beschikbaar,
        });
      }
    }

    const resultaten: Array<{
      rij: number;
      email: string;
      status: "ok" | "fout" | "overgeslagen";
      link: string | null;
      mailStatus: "verstuurd" | "gesimuleerd" | "fout" | "-";
      melding: string;
    }> = [];

    const origin = typeof req.body?.origin === "string" ? req.body.origin.replace(/\/+$/, "") : "";
    const linkType = leesLinkType(req);

    for (const r of rijen) {
      const email = r.waarden.email ?? "";
      // Rij met validatiefout → niet aanmaken.
      if (foutRijen.has(r.rij)) {
        const meldingen = fouten.filter((f) => f.rij === r.rij).map((f) => `${f.kolom}: ${f.melding}`);
        resultaten.push({
          rij: r.rij,
          email,
          status: "fout",
          link: null,
          mailStatus: "-",
          melding: meldingen.join(" | ") || "Ongeldige rij.",
        });
        continue;
      }

      const naam = volledigeNaam(r.waarden);
      const taal = r.waarden.taal || "nl";

      // Blokkeert de leverancier dit adres, dan komt er niets aan. Geen
      // uitnodiging, geen credit, en een rij die zegt waarom.
      const blokkade = geblokkeerdeAdressen.get(email.trim().toLowerCase());
      if (blokkade && !tochAanmaken) {
        resultaten.push({
          rij: r.rij,
          email,
          status: "fout",
          link: null,
          mailStatus: "-",
          melding: blokkade.bezwaar ?? "De mailleverancier blokkeert dit adres.",
        });
        continue;
      }

      // Idempotentie: bestaat er al zo'n uitnodiging. Dan komt er geen tweede
      // uitnodiging en geen tweede credit. Vroeg de beheerder om herverzending,
      // dan gaat het bericht wel opnieuw naar dezelfde link.
      const bestaand = bestaandeUitnodiging(email, instrumentId, organisatieId);
      if (bestaand) {
        const link = bouwUitnodigingsLink(origin, bestaand.inviteToken, linkType);
        if (!herverstuur) {
          resultaten.push({
            rij: r.rij,
            email,
            status: "overgeslagen",
            link,
            mailStatus: "-",
            melding: "Bestond al (zelfde e-mail, instrument en organisatie).",
          });
          continue;
        }
        const herhaling = await verstuurUitnodiging({
          naar: email,
          taal,
          naam,
          link,
          instrument: tpl.titel,
          from: afzenderNaarBuiten,
        });
        resultaten.push({
          rij: r.rij,
          email,
          status: "overgeslagen",
          link,
          mailStatus: herhaling.status,
          melding:
            herhaling.melding ??
            "De uitnodiging bestond al. Wij stuurden het bericht opnieuw en rekenden geen nieuwe credit aan.",
        });
        continue;
      }

      let inv: Afname;
      try {
        inv = await maakBulkUitnodiging({
          organisatieId,
          name: naam || null,
          role: r.waarden.rol || null,
          taal,
          email,
          instrumentId,
          ...verzender,
        });
      } catch (e) {
        resultaten.push({
          rij: r.rij,
          email,
          status: "fout",
          link: null,
          mailStatus: "-",
          melding: e instanceof Error ? e.message : "Aanmaken mislukt.",
        });
        continue;
      }

      // Reserveer 1 credit (net als de bestaande flow).
      if (organisatieId != null) {
        try {
          await storage.reserveer(organisatieId, inv.id);
        } catch (e) {
          await storage.updateAfname(inv.id, { status: "geannuleerd" });
          resultaten.push({
            rij: r.rij,
            email,
            status: "fout",
            link: null,
            mailStatus: "-",
            melding: e instanceof CreditError ? e.message : "Reservering mislukt.",
          });
          continue;
        }
      }

      const link = bouwUitnodigingsLink(origin, inv.inviteToken, linkType);
      const mail = await verstuurUitnodiging({
        naar: email,
        taal,
        naam,
        link,
        instrument: tpl.titel,
        from: afzenderNaarBuiten,
      });

      resultaten.push({
        rij: r.rij,
        email,
        status: "ok",
        link,
        mailStatus: mail.status,
        melding: mail.melding ?? (mail.gesimuleerd ? "De mail is alleen nagebootst (SMTP staat niet ingesteld)." : "Uitnodiging aangemaakt."),
      });
    }

    // Het oordeel over de batch. Aangemaakt is niet verstuurd: alleen een
    // vertrokken bericht telt als geslaagd. Zie server/mailpoort/keuring.ts.
    const oordeel = beoordeelBatch(resultaten);
    const aantalOk = resultaten.filter((r) => r.status === "ok").length;
    res.json({
      instrumentId,
      simulatiemodus: isSimulatiemodus(),
      totaal: rijen.length,
      aantalOk,
      aantalOvergeslagen: resultaten.filter((r) => r.status === "overgeslagen").length,
      aantalHerverstuurd: resultaten.filter(
        (r) => r.status === "overgeslagen" && (r.mailStatus === "verstuurd" || r.mailStatus === "gesimuleerd"),
      ).length,
      aantalFout: resultaten.filter((r) => r.status === "fout").length,
      aantalMailVerstuurd: oordeel.aantalVerstuurd,
      aantalZonderMail: oordeel.aantalZonderMail,
      geslaagd: oordeel.geslaagd,
      mailAlarm: oordeel.alarm,
      mailweg: mailKeuring,
      afzenderGebruikt: afzenderNaarBuiten,
      afzenderTeruggevallen,
      resultaten,
    });
  });

  console.log("[tapas] Bulk-import routes geregistreerd." + (isSimulatiemodus() ? " (mail: SIMULATIEMODUS)" : ""));
  void TEMPLATES;
}
