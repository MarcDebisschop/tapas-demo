// =============================================================================
// server/bulk-import/routes.ts  —  NIEUW BESTAND (Werkprotocol Regel 2)
// -----------------------------------------------------------------------------
// registerBulkImportRoutes(app): admin-endpoints voor bulk-import via Excel/CSV.
//
//   GET  /api/admin/bulk-import/instrumenten            — ondersteunde instrumenten + velden
//   GET  /api/admin/bulk-import/template/:instrumentId  — download .xlsx-template
//   POST /api/admin/bulk-import/preview                 — parse + valideer (maakt niets aan)
//   POST /api/admin/bulk-import/verwerk                 — maak uitnodigingen + verstuur/queue mail
//
// De verwerk-stap HERGEBRUIKT de bestaande uitnodig-logica (saldo-check +
// storage.reserveer, 1 credit per uitnodiging), net als POST /api/uitnodigingen.
// De bestaande repo-functie maakUitnodiging wordt NIET gewijzigd; in plaats
// daarvan schrijft de nieuwe functie maakBulkUitnodiging hieronder direct via
// dezelfde Drizzle-tabel, additief uitgebreid met e-mail + instrumentId.
//
// Org-eigen afzender: opgeslagen in een APARTE kleine tabel org_mail_afzender
// (Regel 1/2 — shared/schema.ts blijft ongewijzigd).
// =============================================================================

import type { Express, Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { storage, db, sqlite, CreditError } from "../storage";
import { afnames, type Afname } from "@shared/schema";
import { getTemplate, alleTemplates, TEMPLATES } from "./templates";
import { templateAlsBuffer, parseUpload, type ParseFout } from "./excel";
import { verstuurUitnodiging, isSimulatiemodus, laatsteMailStatusPerRespondent } from "./mailer";
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
// Prior-beheerdercheck (Werkprotocol Regel 2 — additief).
// Gratis bulk-verzending ZONDER organisatie (geen credits) is voorbehouden aan
// de hoofdbeheerder (isPrior). Gewone admins moeten een organisatie kiezen
// zodat het bestaande credit-model geldt. Deze helper wijzigt niets aan de
// bestaande flow; ze levert enkel de isPrior-status van de ingelogde admin.
// ---------------------------------------------------------------------------
async function isPriorAdmin(req: Request): Promise<boolean> {
  const adminId = (req.session as any)?.adminId;
  if (!adminId) return false;
  try {
    const beheerder = await storage.getBeheerder(Number(adminId));
    return !!beheerder && beheerder.actief === true && beheerder.isPrior === true;
  } catch {
    return false;
  }
}

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
// Linktype voor de uitnodigingsmail (additief — bestaand gedrag = default).
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
      const mail = await verstuurUitnodiging({ naar: email, taal: r.waarden.taal || "nl", naam, link, instrument: titel, from: null, respondentCode: respondent.token });
      mailStatus = mail.status;
      melding = mail.melding ?? (mail.gesimuleerd ? "Mail gesimuleerd (SMTP niet geconfigureerd)." : "Uitnodiging verstuurd.");
    }

    resultaten.push({ rij: r.rij, email, status: "ok", link, mailStatus, melding });
  }

  const aantalOk = resultaten.filter((r) => r.status === "ok").length;
  return res.json({
    instrumentId: "t4o",
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
  app.get("/api/admin/bulk-import/template/:instrumentId", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const tpl = getTemplate(req.params.instrumentId);
    if (!tpl) return res.status(404).json({ error: "Onbekend instrument." });
    const buffer = templateAlsBuffer(tpl);
    const bestandsnaam = `bulk-import_${tpl.instrumentId}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${bestandsnaam}"`);
    res.send(buffer);
  });

  // --- Preview: parse + valideer, maak NIETS aan ---
  app.post("/api/admin/bulk-import/preview", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const instrumentId = String(req.body?.instrumentId ?? "");
    const tpl = getTemplate(instrumentId);
    if (!tpl) return res.status(400).json({ error: "Onbekend of niet-ondersteund instrument." });

    const bestand = leesBestand(req);
    if (!bestand) return res.status(400).json({ error: "Geen bestand ontvangen (bestandBase64 ontbreekt)." });

    const { rijen, fouten } = parseUpload(bestand, tpl);
    const kopFout = fouten.find((f) => f.rij === 0);
    if (kopFout) {
      return res.status(422).json({
        error: "Kolomkoppen komen niet overeen met de template.",
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
  app.post("/api/admin/bulk-import/verwerk", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const instrumentId = String(req.body?.instrumentId ?? "");
    const tpl = getTemplate(instrumentId);
    if (!tpl) return res.status(400).json({ error: "Onbekend of niet-ondersteund instrument." });

    const organisatieId: number | null =
      req.body?.organisatieId != null && Number.isFinite(Number(req.body.organisatieId))
        ? Number(req.body.organisatieId)
        : null;

    // -----------------------------------------------------------------------
    // BEVEILIGING (additief): gratis verzending ZONDER organisatie (geen
    // credits) is voorbehouden aan de hoofdbeheerder (isPrior). Een gewone
    // admin die geen organisatie kiest, krijgt 403 en moet een organisatie
    // selecteren zodat het bestaande credit-model geldt. Verandert niets aan
    // de flow met een gekozen organisatie of voor prior-beheerders.
    // -----------------------------------------------------------------------
    if (organisatieId == null && !(await isPriorAdmin(req))) {
      return res.status(403).json({
        error:
          "Gratis verzending zonder organisatie is voorbehouden aan de hoofdbeheerder. " +
          "Kies een organisatie (credits worden verrekend) of vraag de hoofdbeheerder.",
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
    if (!bestand) return res.status(400).json({ error: "Geen bestand ontvangen (bestandBase64 ontbreekt)." });

    const { rijen, fouten } = parseUpload(bestand, tpl);
    const kopFout = fouten.find((f) => f.rij === 0);
    if (kopFout) {
      return res.status(422).json({ error: "Kolomkoppen komen niet overeen met de template.", fouten });
    }

    // -----------------------------------------------------------------------
    // T4O-organisatiescan: eigen verwerking (geen afname/credit-model). Elke
    // rij wordt een respondent in één nieuwe organisatie-afname; de ring komt
    // uit de kolom 'Ring/Groep'. Retourneert persoonlijke #/t4o/r/:token-links.
    // -----------------------------------------------------------------------
    if (instrumentId === "t4o") {
      const t4oOrigin = typeof req.body?.origin === "string" ? req.body.origin.replace(/\/+$/, "") : "";
      return verwerkT4O(req, res, tpl.titel, rijen, fouten, t4oOrigin);
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

      // Idempotentie: bestaat er al zo'n uitnodiging → overslaan.
      const bestaand = bestaandeUitnodiging(email, instrumentId, organisatieId);
      if (bestaand) {
        const link = bouwUitnodigingsLink(origin, bestaand.inviteToken, linkType);
        resultaten.push({
          rij: r.rij,
          email,
          status: "overgeslagen",
          link,
          mailStatus: "-",
          melding: "Bestond al (zelfde e-mail + instrument + organisatie).",
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
        from: afzender,
        respondentCode: inv.respondentCode ?? inv.inviteToken,
      });

      resultaten.push({
        rij: r.rij,
        email,
        status: "ok",
        link,
        mailStatus: mail.status,
        melding: mail.melding ?? (mail.gesimuleerd ? "Mail gesimuleerd (SMTP niet geconfigureerd)." : "Uitnodiging aangemaakt."),
      });
    }

    const aantalOk = resultaten.filter((r) => r.status === "ok").length;
    res.json({
      instrumentId,
      simulatiemodus: isSimulatiemodus(),
      totaal: rijen.length,
      aantalOk,
      aantalOvergeslagen: resultaten.filter((r) => r.status === "overgeslagen").length,
      aantalFout: resultaten.filter((r) => r.status === "fout").length,
      resultaten,
    });
  });

  // Verzendlog: eerlijke, verifieerbare mailstatus per respondent. De admin-UI
  // kan hiermee tonen of "verstuurd" ook echt aanvaard werd (met messageId), of
  // dat de mail geweigerd/gesimuleerd was. Retourneert ook of het platform nu in
  // simulatiemodus draait, zodat de UI daar een duidelijke waarschuwing bij zet.
  app.get("/api/admin/bulk-import/mail-log", (req, res) => {
    if (!requireAdmin(req, res)) return;
    res.json({
      simulatiemodus: isSimulatiemodus(),
      statusPerRespondent: laatsteMailStatusPerRespondent(),
    });
  });

  console.log("[tapas] Bulk-import routes geregistreerd." + (isSimulatiemodus() ? " (mail: SIMULATIEMODUS)" : ""));
  void TEMPLATES;
}
