/**
 * server/prive-aankoop/routes.ts  —  NIEUW BESTAND (Werkprotocol Regel 2)
 *
 * Privé-aankoopflow voor particulieren (zonder organisatie):
 *   GET  /api/prive-prijzen                    (PUBLIEK)  actieve prijzen
 *   GET  /api/admin/prive-prijzen              (admin)    alle prijzen
 *   PUT  /api/admin/prive-prijzen/:instrumentId (admin)   bedrag/actief wijzigen
 *   POST /api/prive-aankoop/intake             GDPR-intake → Mollie-SIMULATIE
 *   POST /api/prive-aankoop/bevestig           bevestig betaling → factuur + Peppol
 *   GET  /api/prive-aankoop/factuur/:id        factuur (JSON) download
 *
 * SCHEMA-CONSTRAINT (organisatieId NOT NULL): we hergebruiken de HELE bestaande
 * factuur/Peppol-engine door één speciale, lichte "particulier"-organisatie
 * (type: "particulier") éénmalig aan te maken en die als organisatieId te
 * gebruiken. De ECHTE klantgegevens staan in de klantSnapshot van de factuur.
 * (Voorkeursaanpak uit de requirements — maximaal hergebruik, Regel 1.)
 */

import type { Express, Request, Response } from "express";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { db, sqlite } from "../storage";
import {
  betalingen,
  facturen,
  organisaties,
  billerEntiteiten,
} from "@shared/schema";
import type { Organisatie } from "@shared/schema";
import { neemFactuurnummer } from "../factuurnummer";
import {
  initPriveePrijzen,
  lijstAllePrijzen,
  lijstActievePrijzen,
  getPrijs,
  wijzigPrijs,
} from "./prijzen";

const PARTICULIER_NAAM = "Particulier (privé-aankopen)";

// --- Init: intake-tabel + particulier-organisatie -------------------------

let ingesteld = false;
function init(): void {
  if (ingesteld) return;
  initPriveePrijzen();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS prive_aankoop (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      betaling_id   INTEGER NOT NULL,
      instrument_id TEXT NOT NULL,
      intake        TEXT NOT NULL,
      factuur_id    INTEGER,
      aangemaakt_op TEXT NOT NULL
    );
  `);
  ingesteld = true;
}

/** Vind of maak de speciale particulier-organisatie (één record). */
function particulierOrg(): Organisatie {
  const bestaand = db
    .select()
    .from(organisaties)
    .where(eq(organisaties.naam, PARTICULIER_NAAM))
    .get();
  if (bestaand) return bestaand;
  return db
    .insert(organisaties)
    .values({
      naam: PARTICULIER_NAAM,
      type: "particulier",
      peppolBereikbaar: false,
      factuurType: "pdf",
      land: "België",
      createdAt: new Date().toISOString(),
    })
    .returning()
    .get();
}

function actieveBiller() {
  return db
    .select()
    .from(billerEntiteiten)
    .where(eq(billerEntiteiten.actief, true))
    .orderBy(desc(billerEntiteiten.id))
    .get();
}

// F-1 (audit): de eigen kopie van de nummerlogica is verwijderd. Er is nu één
// bron, server/factuurnummer.ts, die het nummer ondeelbaar toekent.

// --- Validatie (strikt: enkel noodzakelijke velden) -----------------------

const intakeSchema = z
  .object({
    instrumentId: z.string().min(1),
    voornaam: z.string().trim().min(1, "Voornaam is verplicht"),
    achternaam: z.string().trim().min(1, "Achternaam is verplicht"),
    email: z.string().trim().email("Ongeldig e-mailadres"),
    // Optioneel adres (enkel indien de particulier het opgeeft).
    adres: z.string().trim().optional(),
    postcode: z.string().trim().optional(),
    gemeente: z.string().trim().optional(),
    // Voor t4teens/t4students: gegevens van het kind/de student.
    kindNaam: z.string().trim().optional(),
    kindEmail: z.string().trim().email("Ongeldig e-mailadres kind").optional(),
    // Expliciete, verplichte GDPR-consent.
    consent: z.literal(true, {
      errorMap: () => ({ message: "Toestemming is verplicht" }),
    }),
  })
  .strict();

const bevestigSchema = z
  .object({ betalingId: z.number().int().positive() })
  .strict();

// --- Router ----------------------------------------------------------------

export function registerPriveAankoopRoutes(app: Express): void {
  init();

  const requireAdmin = (req: Request, res: Response): boolean => {
    const adminId = (req.session as any)?.adminId;
    if (!adminId) {
      res.status(401).json({ error: "Niet ingelogd." });
      return false;
    }
    return true;
  };

  const euroCent = (cent: number) => Number((cent / 100).toFixed(2));

  // -- Prijzen: publiek (enkel actief) --------------------------------------
  app.get("/api/prive-prijzen", (_req, res) => {
    res.json(
      lijstActievePrijzen().map((p) => ({
        instrumentId: p.instrument_id,
        naam: p.naam,
        bedragInclBtwCent: p.bedrag_incl_btw_cent,
        bedragInclBtw: euroCent(p.bedrag_incl_btw_cent),
      })),
    );
  });

  // -- Prijzen: admin (alles) -----------------------------------------------
  app.get("/api/admin/prive-prijzen", (req, res) => {
    if (!requireAdmin(req, res)) return;
    res.json(
      lijstAllePrijzen().map((p) => ({
        instrumentId: p.instrument_id,
        naam: p.naam,
        bedragInclBtwCent: p.bedrag_incl_btw_cent,
        bedragInclBtw: euroCent(p.bedrag_incl_btw_cent),
        actief: p.actief === 1,
        bijgewerktOp: p.bijgewerkt_op,
      })),
    );
  });

  // -- Prijzen: admin wijzigen ----------------------------------------------
  app.put("/api/admin/prive-prijzen/:instrumentId", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const parsed = z
      .object({
        bedragInclBtwCent: z.number().int().positive("Bedrag moet groter dan 0 zijn").optional(),
        actief: z.boolean().optional(),
      })
      .strict()
      .refine((d) => d.bedragInclBtwCent != null || d.actief != null, {
        message: "Geef een bedrag of actief-status op",
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige invoer" });
    }
    const bijgewerkt = wijzigPrijs(req.params.instrumentId, {
      bedrag_incl_btw_cent: parsed.data.bedragInclBtwCent,
      actief: parsed.data.actief == null ? undefined : parsed.data.actief ? 1 : 0,
    });
    if (!bijgewerkt) return res.status(404).json({ error: "Prijs niet gevonden" });
    res.json({
      instrumentId: bijgewerkt.instrument_id,
      naam: bijgewerkt.naam,
      bedragInclBtwCent: bijgewerkt.bedrag_incl_btw_cent,
      bedragInclBtw: euroCent(bijgewerkt.bedrag_incl_btw_cent),
      actief: bijgewerkt.actief === 1,
      bijgewerktOp: bijgewerkt.bijgewerkt_op,
    });
  });

  // -- Intake → Mollie-SIMULATIE betaling -----------------------------------
  app.post("/api/prive-aankoop/intake", (req, res) => {
    const parsed = intakeSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige invoer" });
    }
    const data = parsed.data;
    const prijs = getPrijs(data.instrumentId);
    if (!prijs || prijs.actief !== 1) {
      return res.status(404).json({ error: "Instrument niet beschikbaar voor privé-aankoop" });
    }

    const org = particulierOrg();
    const biller = actieveBiller();
    const btwTarief = biller?.btwTarief ?? 21;
    const inclCent = prijs.bedrag_incl_btw_cent;
    const exclCent = Math.round(inclCent / (1 + btwTarief / 100));
    const btwCent = inclCent - exclCent;
    const now = new Date().toISOString();

    // Mollie-SIMULATIE — identiek patroon aan credits.ts.
    const betaling = db
      .insert(betalingen)
      .values({
        organisatieId: org.id,
        provider: "mollie",
        providerRef: `tr_sim_${Date.now()}`,
        pakketId: `prive:${data.instrumentId}`,
        credits: 0,
        bedragExclBtw: exclCent,
        btwTarief,
        btwBedrag: btwCent,
        bedragInclBtw: inclCent,
        munt: "EUR",
        status: "open",
        checkoutUrl: `#/betaling/sim`,
        createdAt: now,
      })
      .returning()
      .get();

    // Persisteer de intake voor gebruik bij bevestiging (klantSnapshot).
    sqlite
      .prepare(
        `INSERT INTO prive_aankoop (betaling_id, instrument_id, intake, factuur_id, aangemaakt_op)
         VALUES (?, ?, ?, NULL, ?)`,
      )
      .run(betaling.id, data.instrumentId, JSON.stringify(data), now);

    res.json({
      betalingId: betaling.id,
      instrumentId: data.instrumentId,
      naam: prijs.naam,
      bedragInclBtwCent: inclCent,
      bedragInclBtw: euroCent(inclCent),
      checkoutUrl: betaling.checkoutUrl,
    });
  });

  // -- Bevestig (idempotent) → factuur particulier + Peppol UBL -------------
  app.post("/api/prive-aankoop/bevestig", (req, res) => {
    const parsed = bevestigSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige invoer" });
    }
    const betaling = db
      .select()
      .from(betalingen)
      .where(eq(betalingen.id, parsed.data.betalingId))
      .get();
    if (!betaling) return res.status(404).json({ error: "Betaling niet gevonden" });

    const intakeRij = sqlite
      .prepare(`SELECT * FROM prive_aankoop WHERE betaling_id = ?`)
      .get(betaling.id) as
      | { id: number; instrument_id: string; intake: string; factuur_id: number | null }
      | undefined;
    if (!intakeRij) return res.status(404).json({ error: "Privé-aankoop niet gevonden" });

    // Idempotent: reeds betaald → bestaande factuur teruggeven.
    if (betaling.status === "betaald" && betaling.factuurId) {
      const bestaand = db.select().from(facturen).where(eq(facturen.id, betaling.factuurId)).get();
      if (bestaand) {
        return res.json({ factuurId: bestaand.id, factuurnummer: bestaand.factuurnummer, downloadUrl: `/api/prive-aankoop/factuur/${bestaand.id}` });
      }
    }
    if (betaling.status !== "open") {
      return res.status(409).json({ error: `Betaling kan niet bevestigd worden (status: ${betaling.status})` });
    }

    const biller = actieveBiller();
    if (!biller) return res.status(500).json({ error: "Geen actieve facturerende entiteit" });

    const intake = JSON.parse(intakeRij.intake) as z.infer<typeof intakeSchema>;
    const prijs = getPrijs(intakeRij.instrument_id);
    const productNaam = prijs?.naam ?? intakeRij.instrument_id;
    const klantNaam = `${intake.voornaam} ${intake.achternaam}`.trim();
    const now = new Date().toISOString();
    const factuurnummer = neemFactuurnummer(biller.factuurPrefix);

    const regels = [
      {
        omschrijving: `${productNaam} (privé-aankoop)`,
        aantal: 1,
        eenheidsprijsExclCent: betaling.bedragExclBtw,
        btwTarief: betaling.btwTarief,
        totaalExclCent: betaling.bedragExclBtw,
      },
    ];

    // Particulier: GEEN KBO/BTW-nummer bij de klant.
    const klantSnapshot = {
      naam: klantNaam,
      btwNummer: null,
      kboNummer: null,
      peppolId: null,
      email: intake.email,
      adres: intake.adres ?? null,
      postcode: intake.postcode ?? null,
      gemeente: intake.gemeente ?? null,
      land: "België",
    };
    const billerSnapshot = {
      naam: biller.naam,
      vennootschapsnaam: biller.vennootschapsnaam,
      adres: biller.adres,
      postcode: biller.postcode,
      gemeente: biller.gemeente,
      land: biller.land,
      btwNummer: biller.btwNummer,
      kboNummer: biller.kboNummer,
      peppolId: biller.peppolId,
    };

    // Peppol UBL-document — hergebruikt profiel + structuur uit credits.ts.
    const peppolDocument = {
      profiel: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
      documenttype: "Invoice",
      factuurnummer,
      uitgiftedatum: now.slice(0, 10),
      munt: betaling.munt,
      verkoper: {
        naam: biller.vennootschapsnaam,
        btw: biller.btwNummer,
        kbo: biller.kboNummer,
        peppolId: biller.peppolId,
        adres: {
          straat: biller.adres,
          postcode: biller.postcode,
          gemeente: biller.gemeente,
          land: biller.land,
        },
      },
      koper: {
        naam: klantNaam,
        btw: null,
        kbo: null,
        peppolId: null,
        adres: {
          straat: intake.adres ?? null,
          postcode: intake.postcode ?? null,
          gemeente: intake.gemeente ?? null,
          land: "België",
        },
      },
      regels: regels.map((r) => ({
        omschrijving: r.omschrijving,
        aantal: r.aantal,
        eenheidsprijsExclCent: r.eenheidsprijsExclCent,
        btwTarief: r.btwTarief,
        totaalExclCent: r.totaalExclCent,
      })),
      totalen: {
        exclBtwCent: betaling.bedragExclBtw,
        btwCent: betaling.btwBedrag,
        inclBtwCent: betaling.bedragInclBtw,
      },
    };

    // Particulier factuur → kanaal = pdf; peppolDocument wél gevuld.
    const factuur = db
      .insert(facturen)
      .values({
        factuurnummer,
        billerEntiteitId: biller.id,
        organisatieId: betaling.organisatieId,
        betalingId: betaling.id,
        billerSnapshot: JSON.stringify(billerSnapshot),
        klantSnapshot: JSON.stringify(klantSnapshot),
        regels: JSON.stringify(regels),
        bedragExclBtw: betaling.bedragExclBtw,
        btwBedrag: betaling.btwBedrag,
        bedragInclBtw: betaling.bedragInclBtw,
        munt: betaling.munt,
        kanaal: "pdf",
        peppolStatus: "klaar",
        peppolDocument: JSON.stringify(peppolDocument),
        factuurdatum: now,
        createdAt: now,
      })
      .returning()
      .get();

    db.update(betalingen)
      .set({ status: "betaald", methode: "mollie-sim", betaaldAt: now, factuurId: factuur.id })
      .where(eq(betalingen.id, betaling.id))
      .run();

    sqlite
      .prepare(`UPDATE prive_aankoop SET factuur_id = ? WHERE betaling_id = ?`)
      .run(factuur.id, betaling.id);

    res.json({
      factuurId: factuur.id,
      factuurnummer: factuur.factuurnummer,
      downloadUrl: `/api/prive-aankoop/factuur/${factuur.id}`,
    });
  });

  // -- Factuur download (JSON) ----------------------------------------------
  app.get("/api/prive-aankoop/factuur/:id", (req, res) => {
    const id = Number(req.params.id);
    const factuur = db.select().from(facturen).where(eq(facturen.id, id)).get();
    if (!factuur) return res.status(404).json({ error: "Factuur niet gevonden" });
    const payload = {
      factuurnummer: factuur.factuurnummer,
      factuurdatum: factuur.factuurdatum,
      munt: factuur.munt,
      biller: JSON.parse(factuur.billerSnapshot),
      klant: JSON.parse(factuur.klantSnapshot),
      regels: JSON.parse(factuur.regels),
      bedragExclBtwCent: factuur.bedragExclBtw,
      btwBedragCent: factuur.btwBedrag,
      bedragInclBtwCent: factuur.bedragInclBtw,
      kanaal: factuur.kanaal,
      peppolDocument: factuur.peppolDocument ? JSON.parse(factuur.peppolDocument) : null,
    };
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${factuur.factuurnummer}.json"`,
    );
    res.send(JSON.stringify(payload, null, 2));
  });
}
