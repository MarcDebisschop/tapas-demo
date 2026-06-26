// ---------------------------------------------------------------------------
// TaPas Platform — Extra routes: Coaches, Academy, Mailbeheer, Inzichtcentrum
//
// Dit bestand voegt alle ontbrekende API-endpoints toe voor de admin-pagina's
// die in de originele bundle (index-CxFhBwUz.js) aanwezig zijn.
//
// REGELS:
// - routes.ts wordt NIET gewijzigd
// - Tabellen worden inline aangemaakt via CREATE TABLE IF NOT EXISTS
// - Alle write-endpoints vereisen admin-sessie
// - GET /api/coaches/publiek is publiek
// ---------------------------------------------------------------------------

import type { Express } from "express";
import type { Request, Response } from "express";
import { sqlite as sqliteInstance } from "./storage";

// Helperfunctie: haal de sqlite-instantie op
// Gebruikt eerst de directe export, daarna fallback op db/storage parameters
function getSqlite(db: any, storage: any): any {
  return sqliteInstance ?? db?._db ?? storage?.sqlite ?? null;
}

// Controleer admin-sessie
function requireAdmin(req: Request, res: Response): boolean {
  const adminId = (req.session as any)?.adminId;
  if (!adminId) {
    res.status(401).json({ error: "Niet ingelogd." });
    return false;
  }
  return true;
}

export function registerCoachesAcademyMailRoutes(app: Express, db: any, storage: any): void {
  // =========================================================================
  // DB-tabellen aanmaken (idempotent)
  // =========================================================================
  const sqlite = getSqlite(db, storage);

  if (sqlite) {
    // Coaches register
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS coach_register (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        naam TEXT NOT NULL,
        plaats TEXT NOT NULL DEFAULT '',
        regioSleutel TEXT NOT NULL DEFAULT 'Vlaanderen',
        land TEXT NOT NULL DEFAULT 'BE',
        expertise TEXT NOT NULL DEFAULT '[]',
        email TEXT NOT NULL DEFAULT '',
        fotoUrl TEXT NOT NULL DEFAULT '',
        opleidingTitel TEXT NOT NULL DEFAULT '',
        behaaldOp TEXT NOT NULL DEFAULT '',
        toestemmingRegister INTEGER NOT NULL DEFAULT 0,
        zichtbaarInRegister INTEGER NOT NULL DEFAULT 0,
        actief INTEGER NOT NULL DEFAULT 1,
        demo INTEGER NOT NULL DEFAULT 0,
        aangemaakt_op TEXT NOT NULL DEFAULT (datetime('now')),
        bijgewerkt_op TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Coach accreditaties
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS coach_accreditaties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        coach_id INTEGER NOT NULL REFERENCES coach_register(id) ON DELETE CASCADE,
        instrument_id TEXT NOT NULL,
        niveau INTEGER NOT NULL DEFAULT 1,
        behaald_op TEXT NOT NULL DEFAULT '',
        geldig_tot TEXT NOT NULL DEFAULT '',
        actief INTEGER NOT NULL DEFAULT 1,
        aangemaakt_op TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Academy opleidingen
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS academy_opleidingen (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        titel TEXT NOT NULL,
        korteOmschrijving TEXT NOT NULL DEFAULT '',
        volledigeOmschrijving TEXT NOT NULL DEFAULT '',
        accreditatieNiveau INTEGER,
        format TEXT NOT NULL DEFAULT 'online',
        locatie TEXT NOT NULL DEFAULT '',
        duurDagen INTEGER NOT NULL DEFAULT 0,
        prijs REAL NOT NULL DEFAULT 0,
        valuta TEXT NOT NULL DEFAULT 'EUR',
        status TEXT NOT NULL DEFAULT 'beschikbaar',
        actief INTEGER NOT NULL DEFAULT 1,
        demo INTEGER NOT NULL DEFAULT 0,
        aangemaakt_op TEXT NOT NULL DEFAULT (datetime('now')),
        bijgewerkt_op TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Academy sessies (startmomenten per opleiding)
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS academy_sessies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        opleiding_id INTEGER NOT NULL REFERENCES academy_opleidingen(id) ON DELETE CASCADE,
        startdatum TEXT NOT NULL,
        eindatum TEXT NOT NULL DEFAULT '',
        locatie TEXT NOT NULL DEFAULT '',
        format TEXT NOT NULL DEFAULT 'online',
        max_deelnemers INTEGER,
        actief INTEGER NOT NULL DEFAULT 1,
        aangemaakt_op TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Academy docenten
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS academy_docenten (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        naam TEXT NOT NULL,
        rol TEXT NOT NULL DEFAULT '',
        bio TEXT NOT NULL DEFAULT '',
        fotoPad TEXT NOT NULL DEFAULT '',
        actief INTEGER NOT NULL DEFAULT 1,
        aangemaakt_op TEXT NOT NULL DEFAULT (datetime('now')),
        bijgewerkt_op TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Academy inschrijvingen
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS academy_inschrijvingen (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        opleiding_id INTEGER NOT NULL REFERENCES academy_opleidingen(id),
        sessie_id INTEGER REFERENCES academy_sessies(id),
        type TEXT NOT NULL DEFAULT 'deelnemer',
        naam TEXT NOT NULL,
        email TEXT NOT NULL,
        taal TEXT NOT NULL DEFAULT 'nl',
        organisatieNaam TEXT NOT NULL DEFAULT '',
        aantalDeelnemers INTEGER,
        bericht TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'nieuw',
        aangemaakt_op TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Academy vragen
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS academy_vragen (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        naam TEXT NOT NULL,
        email TEXT NOT NULL,
        taal TEXT NOT NULL DEFAULT 'nl',
        onderwerp TEXT NOT NULL DEFAULT '',
        bericht TEXT NOT NULL,
        afgehandeld INTEGER NOT NULL DEFAULT 0,
        aangemaakt_op TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Mail teksten (per template, per taal)
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS mail_teksten (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        templateKey TEXT NOT NULL,
        taal TEXT NOT NULL,
        onderwerp TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        bijgewerkt_op TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(templateKey, taal)
      )
    `);

    // Mail huisstijl (platform-niveau)
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS mail_huisstijl (
        id INTEGER PRIMARY KEY DEFAULT 1,
        logo TEXT NOT NULL DEFAULT '',
        accentKleur TEXT NOT NULL DEFAULT '#e87c20',
        afzender TEXT NOT NULL DEFAULT 'TaPasCity <noreply@tapascity.com>',
        bijgewerkt_op TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    sqlite.exec(`INSERT OR IGNORE INTO mail_huisstijl (id) VALUES (1)`);

    // Seed demo-coaches als de tabel leeg is
    const coachCount = (sqlite.prepare("SELECT COUNT(*) AS n FROM coach_register").get() as any).n;
    if (coachCount === 0) {
      const insertCoach = sqlite.prepare(`
        INSERT INTO coach_register (naam, plaats, regioSleutel, land, expertise, email, fotoUrl, opleidingTitel, behaaldOp, toestemmingRegister, zichtbaarInRegister, actief, demo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const demoCoaches = [
        { naam: "Marc Debisschop", plaats: "Wortegem", regio: "Oost-Vlaanderen", land: "BE", expertise: ["Talentontwikkeling", "Loopbaanbegeleiding", "Energie & veerkracht"], email: "marc@tapascity.com", foto: "/jester/portret-marc.jpg", opl: "TaPas Jester – Niveau 4", behaald: "2024", toestemming: 1, zichtbaar: 1, actief: 1, demo: 1 },
        { naam: "Leen Vandenberghe", plaats: "Gent", regio: "Oost-Vlaanderen", land: "BE", expertise: ["Coaching", "Talentontwikkeling", "Leiderschapsontwikkeling"], email: "leen@tapas-demo.be", foto: "/jester/portret-leen.jpg", opl: "TaPas Accreditatie – Niveau 3", behaald: "2024", toestemming: 1, zichtbaar: 1, actief: 1, demo: 1 },
        { naam: "Herman Claes", plaats: "Antwerpen", regio: "Antwerpen", land: "BE", expertise: ["Organisatieontwikkeling", "Teamcoaching", "Managementontwikkeling"], email: "herman@tapas-demo.be", foto: "/jester/portret-herman.jpg", opl: "TaPas Accreditatie – Niveau 2", behaald: "2023", toestemming: 1, zichtbaar: 1, actief: 1, demo: 1 },
        { naam: "Kris Maes", plaats: "Brussel", regio: "Brussel", land: "BE", expertise: ["Loopbaanbegeleiding", "Outplacement", "Veerkracht"], email: "kris@tapas-demo.be", foto: "/jester/portret-kris.jpg", opl: "TaPas Accreditatie – Niveau 2", behaald: "2023", toestemming: 1, zichtbaar: 0, actief: 1, demo: 1 },
      ];
      for (const c of demoCoaches) {
        insertCoach.run(c.naam, c.plaats, c.regio, c.land, JSON.stringify(c.expertise), c.email, c.foto, c.opl, c.behaald, c.toestemming, c.zichtbaar, c.actief, c.demo);
      }
      console.log("[tapas] Demo-coaches geseed.");
    }

    // Seed demo-docenten als de tabel leeg is
    const docentCount = (sqlite.prepare("SELECT COUNT(*) AS n FROM academy_docenten").get() as any).n;
    if (docentCount === 0) {
      const insertDocent = sqlite.prepare(`
        INSERT INTO academy_docenten (naam, rol, bio, fotoPad, actief) VALUES (?, ?, ?, ?, ?)
      `);
      insertDocent.run("Marc Debisschop", "Oprichter & Hoofddocent", "Marc Debisschop is organisatiepsycholoog, auteur van het TaPas-model en bedenker van het T4P Business Kompas. Hij begeleidt coaches wereldwijd in de toepassing van talentpsychologie.", "/academy/docent-marc.jpg", 1);
      insertDocent.run("Leen Vandenberghe", "Praktijkbegeleider", "Leen begeleidt coaches in de praktijkintegratie van het TaPas-model. Ze is expert in loopbaanbegeleiding en energiemanagement.", "/academy/docent-leen.jpg", 1);
      console.log("[tapas] Demo-docenten geseed.");
    }

    // Seed demo-opleidingen als de tabel leeg is
    const opleidingCount = (sqlite.prepare("SELECT COUNT(*) AS n FROM academy_opleidingen").get() as any).n;
    if (opleidingCount === 0) {
      const ins = sqlite.prepare(`
        INSERT INTO academy_opleidingen (slug, titel, korteOmschrijving, volledigeOmschrijving, accreditatieNiveau, format, locatie, duurDagen, prijs, valuta, status, demo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      ins.run("t4p-basisopleiding", "T4P Business Kompas — Basisopleiding", "Introductie tot het TaPas-model, talentfoci en energiebeheer voor coaches en HR-professionals.", "Verdiepende tweedaagse opleiding met theorie en praktijksimulaties. Inclusief oefensessies met het T4P Business Kompas profiel.", 1, "live", "Gent", 2, 795, "EUR", "beschikbaar", 1);
      ins.run("t4p-verdieping", "T4P Business Kompas — Verdieping", "Diepgaande analyse van talentversnellers, drivers en coachingsinterventies op organisatieniveau.", "Driedaagse verdiepingsopleiding voor gecertificeerde TaPas-coaches. Focus op organisatiediagnose en teamdynamieken.", 2, "live", "Brussel", 3, 1095, "EUR", "beschikbaar", 1);
      ins.run("t4r-selectieprofessional", "T4Recruitment — Selectieprofessional", "Gebruik van T4Recruitment in wervings- en selectietrajecten. Interviewtechnieken en rapportinterpretatie.", "Eendaagse praktijktraining voor HR-professionals en recruiters.", 1, "live", "Antwerpen", 1, 495, "EUR", "beschikbaar", 1);
      ins.run("teamscan-teamanalyse", "TeamScan — Teamanalyse & Facilitation", "Teamdynamieken analyseren en faciliteren met de TasScan. Rol van de coach bij teamontwikkeling.", "Tweedaagse opleiding met live teamsimulaties.", 2, "live", "Gent", 2, 895, "EUR", "binnenkort", 1);
      ins.run("2minscan-energetisch", "2MinScan — Energetisch gedragsprofiel", "Snelle energiescans integreren in coaching- en HR-trajecten. Interpretatie en rapportage.", "Halfdagse opleiding voor gecertificeerde coaches.", 1, "online", "", 0, 295, "EUR", "binnenkort", 1);
      console.log("[tapas] Demo-opleidingen geseed.");
    }

    console.log("[tapas] Coaches/Academy/Mail routes + tabellen geregistreerd.");
  }

  // =========================================================================
  // COACHES — Publiek register
  // =========================================================================

  app.get("/api/coaches/publiek", (_req, res) => {
    const sq = getSqlite(db, storage);
    if (!sq) return res.json([]);
    try {
      const coaches = sq.prepare(`
        SELECT c.id, c.naam, c.plaats, c.regioSleutel, c.land, c.expertise, c.fotoUrl, c.opleidingTitel, c.demo,
               c.email
        FROM coach_register c
        WHERE c.actief = 1 AND c.toestemmingRegister = 1 AND c.zichtbaarInRegister = 1
        ORDER BY c.naam ASC
      `).all() as any[];

      // Voeg accreditaties toe per coach
      const result = coaches.map((c: any) => {
        const accreditaties = sq.prepare(`
          SELECT ca.id, ca.instrument_id, ca.niveau, ca.behaald_op, ca.geldig_tot
          FROM coach_accreditaties ca
          WHERE ca.coach_id = ? AND ca.actief = 1
          ORDER BY ca.niveau DESC
        `).all(c.id) as any[];

        return {
          ...c,
          expertise: tryParseJson(c.expertise, []),
          instrumenten: accreditaties.map((a: any) => ({
            id: a.instrument_id,
            naam: instrumentNaam(a.instrument_id),
            niveau: a.niveau,
          })),
        };
      });

      return res.json(result);
    } catch (e) {
      console.error("[coaches/publiek]", e);
      return res.status(500).json({ error: "Ophalen mislukt." });
    }
  });

  // =========================================================================
  // COACHES — Admin CRUD
  // =========================================================================

  // GET /api/admin/coaches — volledige lijst voor de admin
  app.get("/api/admin/coaches", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const sq = getSqlite(db, storage);
    if (!sq) return res.json([]);
    try {
      const coaches = sq.prepare(`
        SELECT * FROM coach_register ORDER BY naam ASC
      `).all() as any[];
      const result = coaches.map((c: any) => ({
        ...c,
        toestemmingRegister: Boolean(c.toestemmingRegister),
        zichtbaarInRegister: Boolean(c.zichtbaarInRegister),
        actief: Boolean(c.actief),
        demo: Boolean(c.demo),
        expertise: tryParseJson(c.expertise, []),
      }));
      return res.json(result);
    } catch (e) {
      console.error("[admin/coaches GET]", e);
      return res.status(500).json({ error: "Ophalen mislukt." });
    }
  });

  // POST /api/admin/coaches — nieuwe coach aanmaken
  app.post("/api/admin/coaches", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const sq = getSqlite(db, storage);
    if (!sq) return res.status(500).json({ error: "DB niet beschikbaar." });
    try {
      const b = req.body;
      const result = sq.prepare(`
        INSERT INTO coach_register (naam, plaats, regioSleutel, land, expertise, email, fotoUrl, opleidingTitel, behaaldOp, toestemmingRegister, zichtbaarInRegister, actief, demo, bijgewerkt_op)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
      `).run(
        b.naam ?? "", b.plaats ?? "", b.regioSleutel ?? "Vlaanderen", b.land ?? "BE",
        JSON.stringify(Array.isArray(b.expertise) ? b.expertise : []),
        b.email ?? "", b.fotoUrl ?? "", b.opleidingTitel ?? "", b.behaaldOp ?? "",
        b.toestemmingRegister ? 1 : 0, b.zichtbaarInRegister ? 1 : 0, b.actief !== false ? 1 : 0
      );
      return res.json({ id: (result as any).lastInsertRowid });
    } catch (e) {
      console.error("[admin/coaches POST]", e);
      return res.status(500).json({ error: "Opslaan mislukt." });
    }
  });

  // PUT /api/admin/coaches/:id — coach bewerken
  app.put("/api/admin/coaches/:id", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const sq = getSqlite(db, storage);
    if (!sq) return res.status(500).json({ error: "DB niet beschikbaar." });
    try {
      const id = Number(req.params.id);
      const b = req.body;
      sq.prepare(`
        UPDATE coach_register SET
          naam = ?, plaats = ?, regioSleutel = ?, land = ?, expertise = ?,
          email = ?, fotoUrl = ?, opleidingTitel = ?, behaaldOp = ?,
          toestemmingRegister = ?, zichtbaarInRegister = ?, actief = ?,
          bijgewerkt_op = datetime('now')
        WHERE id = ?
      `).run(
        b.naam ?? "", b.plaats ?? "", b.regioSleutel ?? "Vlaanderen", b.land ?? "BE",
        JSON.stringify(Array.isArray(b.expertise) ? b.expertise : []),
        b.email ?? "", b.fotoUrl ?? "", b.opleidingTitel ?? "", b.behaaldOp ?? "",
        b.toestemmingRegister ? 1 : 0, b.zichtbaarInRegister ? 1 : 0, b.actief !== false ? 1 : 0,
        id
      );
      return res.json({ ok: true });
    } catch (e) {
      console.error("[admin/coaches PUT]", e);
      return res.status(500).json({ error: "Bijwerken mislukt." });
    }
  });

  // DELETE /api/admin/coaches/:id — coach verwijderen
  app.delete("/api/admin/coaches/:id", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const sq = getSqlite(db, storage);
    if (!sq) return res.status(500).json({ error: "DB niet beschikbaar." });
    try {
      const id = Number(req.params.id);
      sq.prepare("DELETE FROM coach_accreditaties WHERE coach_id = ?").run(id);
      sq.prepare("DELETE FROM coach_register WHERE id = ?").run(id);
      return res.json({ ok: true });
    } catch (e) {
      console.error("[admin/coaches DELETE]", e);
      return res.status(500).json({ error: "Verwijderen mislukt." });
    }
  });

  // =========================================================================
  // COACH ACCREDITATIES (Zxe queryKey → /api/admin/instrumenten)
  // =========================================================================

  // GET /api/admin/coaches/:id/toegangen — accreditaties van een coach
  app.get("/api/admin/coaches/:id/toegangen", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const sq = getSqlite(db, storage);
    if (!sq) return res.json([]);
    try {
      const id = Number(req.params.id);
      const rijen = sq.prepare(`
        SELECT * FROM coach_accreditaties WHERE coach_id = ? ORDER BY aangemaakt_op DESC
      `).all(id) as any[];
      return res.json(rijen.map((r: any) => ({ ...r, actief: Boolean(r.actief) })));
    } catch (e) {
      return res.status(500).json({ error: "Ophalen mislukt." });
    }
  });

  // POST /api/admin/coaches/:id/toegangen — accreditatie toevoegen
  app.post("/api/admin/coaches/:id/toegangen", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const sq = getSqlite(db, storage);
    if (!sq) return res.status(500).json({ error: "DB niet beschikbaar." });
    try {
      const coach_id = Number(req.params.id);
      const b = req.body;
      const result = sq.prepare(`
        INSERT INTO coach_accreditaties (coach_id, instrument_id, niveau, behaald_op, geldig_tot, actief)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(coach_id, b.instrument_id ?? "", b.niveau ?? 1, b.behaald_op ?? "", b.geldig_tot ?? "");
      return res.json({ id: (result as any).lastInsertRowid });
    } catch (e) {
      return res.status(500).json({ error: "Opslaan mislukt." });
    }
  });

  // DELETE /api/admin/coaches/:id/toegangen/:tid
  app.delete("/api/admin/coaches/:id/toegangen/:tid", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const sq = getSqlite(db, storage);
    if (!sq) return res.status(500).json({ error: "DB niet beschikbaar." });
    try {
      sq.prepare("DELETE FROM coach_accreditaties WHERE id = ?").run(Number(req.params.tid));
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Verwijderen mislukt." });
    }
  });

  // GET /api/admin/instrumenten — lijst van beschikbare instrumenten voor accreditaties
  app.get("/api/admin/instrumenten", (req, res) => {
    if (!requireAdmin(req, res)) return;
    return res.json([
      { id: "t4p", naam: "T4P Business Kompas" },
      { id: "t4s", naam: "T4Students Studiekompas" },
      { id: "t4r", naam: "T4Recruitment" },
      { id: "teamscan", naam: "TaPas Teamscan" },
      { id: "2minscan", naam: "2MinScan Energieprofiel" },
      { id: "hdd", naam: "HDD Rapport" },
      { id: "impact", naam: "Impact Assessment" },
    ]);
  });

  // =========================================================================
  // INZICHTCENTRUM — Analytics dashboard
  // =========================================================================

  app.get("/api/inzichtcentrum/overzicht", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const sq = getSqlite(db, storage);
    if (!sq) return res.json(leegInzichtoverzicht("platform", null));

    try {
      const orgId = req.query.organisatie_id ? Number(req.query.organisatie_id) : null;

      // Basis tellingen
      const afnamesTotaal = (sq.prepare("SELECT COUNT(*) AS n FROM afnames").get() as any)?.n ?? 0;
      const afnamesVoltooid = (sq.prepare("SELECT COUNT(*) AS n FROM afnames WHERE status = 'voltooid'").get() as any)?.n ?? 0;
      const orgCount = (sq.prepare("SELECT COUNT(*) AS n FROM organisaties").get() as any)?.n ?? 0;
      const deelCount = (sq.prepare("SELECT COUNT(*) AS n FROM deelnemers").get() as any)?.n ?? 0;

      // Coach netwerk
      const coachActief = (sq.prepare("SELECT COUNT(*) AS n FROM coach_register WHERE actief = 1").get() as any)?.n ?? 0;

      // Coach netwerk verdelingen
      const coachPerLand = sq.prepare("SELECT land AS sleutel, COUNT(*) AS aantal FROM coach_register WHERE actief = 1 GROUP BY land").all() as any[];
      const coachPerRegio = sq.prepare("SELECT regioSleutel AS sleutel, COUNT(*) AS aantal FROM coach_register WHERE actief = 1 GROUP BY regioSleutel").all() as any[];
      const coachPerAccr = sq.prepare(`
        SELECT ca.instrument_id AS sleutel, COUNT(*) AS aantal
        FROM coach_accreditaties ca
        JOIN coach_register cr ON cr.id = ca.coach_id
        WHERE ca.actief = 1 AND cr.actief = 1
        GROUP BY ca.instrument_id
      `).all() as any[];

      // Evolutie per maand (laatste 12 maanden)
      const evolutie = sq.prepare(`
        SELECT strftime('%Y-%m', created_at) AS maand, COUNT(*) AS aantal
        FROM afnames
        WHERE created_at >= date('now', '-12 months')
        GROUP BY maand
        ORDER BY maand ASC
      `).all() as any[];

      // Gender verdeling (via profiel_data JSON veld als het bestaat)
      const gender = [
        { sleutel: "M", label: "Man", aantal: null, benchmarkPct: null },
        { sleutel: "V", label: "Vrouw", aantal: null, benchmarkPct: null },
        { sleutel: "X", label: "Non-binair / anders", aantal: null, benchmarkPct: null },
      ];

      // Sector verdeling — placeholder
      const sector = [
        { sleutel: "bedrijf", label: "Bedrijf", aantal: null, benchmarkPct: null },
        { sleutel: "overheid", label: "Overheid", aantal: null, benchmarkPct: null },
        { sleutel: "onderwijs", label: "Onderwijs", aantal: null, benchmarkPct: null },
        { sleutel: "nonprofit", label: "Non-profit", aantal: null, benchmarkPct: null },
      ];

      const drempels = {
        factoranalyse: { benodigd: 300, huidig: afnamesTotaal, gehaald: afnamesTotaal >= 300 },
        radar: { benodigd: 150, huidig: afnamesTotaal, gehaald: afnamesTotaal >= 150 },
        brug: { benodigd: 500, huidig: afnamesTotaal, gehaald: afnamesTotaal >= 500 },
      };

      const overzicht = {
        as: orgId ? "organisatie" : "platform",
        organisatie: null as any,
        gegenereerdOp: new Date().toISOString(),
        totalen: {
          afnamesTotaal,
          afnamesVoltooid,
          organisaties: orgCount,
          deelnemers: deelCount,
        },
        gender: gender.map(toVerdelingRij),
        roleLevel: [],
        sector: sector.map(toVerdelingRij),
        land: [],
        organisatieType: [],
        instrument: [],
        evolutie: evolutie.map((e: any) => ({ maand: e.maand, aantal: e.aantal, onderdrukt: false })),
        coachNetwerk: {
          totaalActief: coachActief,
          perLand: coachPerLand.map((r: any) => ({ sleutel: r.sleutel, label: r.sleutel, aantal: r.aantal, benchmarkPct: null })),
          perRegio: coachPerRegio.map((r: any) => ({ sleutel: r.sleutel, label: r.sleutel, aantal: r.aantal, benchmarkPct: null })),
          perAccreditatie: coachPerAccr.map((r: any) => ({ sleutel: r.sleutel, label: r.sleutel, aantal: r.aantal, benchmarkPct: null })),
        },
        drempels,
      };

      if (orgId) {
        const org = sq.prepare("SELECT id, naam FROM organisaties WHERE id = ?").get(orgId) as any;
        overzicht.organisatie = org ?? null;
        // Gefilterde tellingen
        const orgAfnames = (sq.prepare("SELECT COUNT(*) AS n FROM afnames WHERE organisatie_id = ?").get(orgId) as any)?.n ?? 0;
        const orgVoltooid = (sq.prepare("SELECT COUNT(*) AS n FROM afnames WHERE organisatie_id = ? AND status = 'voltooid'").get(orgId) as any)?.n ?? 0;
        overzicht.totalen.afnamesTotaal = orgAfnames;
        overzicht.totalen.afnamesVoltooid = orgVoltooid;
        overzicht.totalen.organisaties = orgId ? 1 : orgCount;
      }

      return res.json(overzicht);
    } catch (e) {
      console.error("[inzichtcentrum]", e);
      return res.status(500).json({ error: "Ophalen mislukt." });
    }
  });

  // =========================================================================
  // ACADEMY — Publieke endpoints
  // =========================================================================

  // GET /api/academy/opleidingen
  app.get("/api/academy/opleidingen", (_req, res) => {
    const sq = getSqlite(db, storage);
    if (!sq) return res.json([]);
    try {
      const opleidingen = sq.prepare(`
        SELECT o.*, GROUP_CONCAT(s.id || ':' || s.startdatum || ':' || s.format || ':' || COALESCE(s.locatie,''), '|') AS sessiesRaw
        FROM academy_opleidingen o
        LEFT JOIN academy_sessies s ON s.opleiding_id = o.id AND s.actief = 1
        WHERE o.actief = 1
        GROUP BY o.id
        ORDER BY o.id ASC
      `).all() as any[];

      return res.json(opleidingen.map((o: any) => ({
        ...o,
        actief: Boolean(o.actief),
        sessies: parseSessies(o.sessiesRaw),
      })));
    } catch (e) {
      console.error("[academy/opleidingen]", e);
      return res.status(500).json({ error: "Ophalen mislukt." });
    }
  });

  // GET /api/academy/docenten
  app.get("/api/academy/docenten", (_req, res) => {
    const sq = getSqlite(db, storage);
    if (!sq) return res.json([]);
    try {
      const docenten = sq.prepare(`
        SELECT * FROM academy_docenten WHERE actief = 1 ORDER BY id ASC
      `).all() as any[];
      return res.json(docenten.map((d: any) => ({ ...d, actief: Boolean(d.actief) })));
    } catch (e) {
      return res.status(500).json({ error: "Ophalen mislukt." });
    }
  });

  // POST /api/academy/inschrijvingen — publiek, inschrijving indienen
  app.post("/api/academy/inschrijvingen", (req, res) => {
    const sq = getSqlite(db, storage);
    if (!sq) return res.status(500).json({ error: "DB niet beschikbaar." });
    try {
      const b = req.body;
      sq.prepare(`
        INSERT INTO academy_inschrijvingen (opleiding_id, sessie_id, type, naam, email, taal, organisatieNaam, aantalDeelnemers, bericht)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        b.opleidingId, b.sessieId ?? null, b.type ?? "deelnemer",
        b.naam ?? "", b.email ?? "", b.taal ?? "nl",
        b.organisatieNaam ?? "", b.aantalDeelnemers ?? null, b.bericht ?? ""
      );
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Inschrijving mislukt." });
    }
  });

  // POST /api/academy/vragen — publiek, vraag indienen
  app.post("/api/academy/vragen", (req, res) => {
    const sq = getSqlite(db, storage);
    if (!sq) return res.status(500).json({ error: "DB niet beschikbaar." });
    try {
      const b = req.body;
      sq.prepare(`
        INSERT INTO academy_vragen (naam, email, taal, onderwerp, bericht)
        VALUES (?, ?, ?, ?, ?)
      `).run(b.naam ?? "", b.email ?? "", b.taal ?? "nl", b.onderwerp ?? "", b.bericht ?? "");
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Opslaan mislukt." });
    }
  });

  // =========================================================================
  // ACADEMY — Admin endpoints
  // =========================================================================

  // GET /api/academy/inschrijvingen
  app.get("/api/academy/inschrijvingen", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const sq = getSqlite(db, storage);
    if (!sq) return res.json([]);
    try {
      const rows = sq.prepare(`
        SELECT ai.*, ao.titel AS opleiding_titel
        FROM academy_inschrijvingen ai
        LEFT JOIN academy_opleidingen ao ON ao.id = ai.opleiding_id
        ORDER BY ai.aangemaakt_op DESC
      `).all();
      return res.json(rows);
    } catch (e) {
      return res.status(500).json({ error: "Ophalen mislukt." });
    }
  });

  // PUT /api/academy/inschrijvingen/:id
  app.put("/api/academy/inschrijvingen/:id", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const sq = getSqlite(db, storage);
    if (!sq) return res.status(500).json({ error: "DB niet beschikbaar." });
    try {
      sq.prepare("UPDATE academy_inschrijvingen SET status = ? WHERE id = ?").run(req.body.status ?? "nieuw", Number(req.params.id));
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Bijwerken mislukt." });
    }
  });

  // GET /api/academy/vragen
  app.get("/api/academy/vragen", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const sq = getSqlite(db, storage);
    if (!sq) return res.json([]);
    try {
      return res.json(sq.prepare("SELECT * FROM academy_vragen ORDER BY aangemaakt_op DESC").all());
    } catch (e) {
      return res.status(500).json({ error: "Ophalen mislukt." });
    }
  });

  // PUT /api/academy/vragen/:id
  app.put("/api/academy/vragen/:id", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const sq = getSqlite(db, storage);
    if (!sq) return res.status(500).json({ error: "DB niet beschikbaar." });
    try {
      sq.prepare("UPDATE academy_vragen SET afgehandeld = ? WHERE id = ?").run(req.body.afgehandeld ? 1 : 0, Number(req.params.id));
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Bijwerken mislukt." });
    }
  });

  // Admin CRUD voor opleidingen, sessies, docenten (register-tabblad)
  app.get("/api/academy/admin/opleidingen", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const sq = getSqlite(db, storage);
    if (!sq) return res.json([]);
    try {
      return res.json(sq.prepare("SELECT * FROM academy_opleidingen ORDER BY id DESC").all());
    } catch (e) {
      return res.status(500).json({ error: "Ophalen mislukt." });
    }
  });

  app.get("/api/academy/admin/sessies", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const sq = getSqlite(db, storage);
    if (!sq) return res.json([]);
    try {
      return res.json(sq.prepare("SELECT * FROM academy_sessies ORDER BY startdatum ASC").all());
    } catch (e) {
      return res.status(500).json({ error: "Ophalen mislukt." });
    }
  });

  app.get("/api/academy/admin/docenten", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const sq = getSqlite(db, storage);
    if (!sq) return res.json([]);
    try {
      return res.json(sq.prepare("SELECT * FROM academy_docenten ORDER BY id ASC").all());
    } catch (e) {
      return res.status(500).json({ error: "Ophalen mislukt." });
    }
  });

  // =========================================================================
  // MAILBEHEER — Admin endpoints
  // =========================================================================

  // GET /api/admin/mailteksten
  app.get("/api/admin/mailteksten", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const sq = getSqlite(db, storage);
    if (!sq) return res.json({ talen: ["nl", "fr", "en", "es", "ru"], templates: [] });
    try {
      const rijen = sq.prepare("SELECT * FROM mail_teksten ORDER BY templateKey ASC, taal ASC").all() as any[];
      // Groepeer per templateKey
      const templateMap: Record<string, any> = {};
      for (const r of rijen) {
        if (!templateMap[r.templateKey]) {
          templateMap[r.templateKey] = { templateKey: r.templateKey, teksten: {} };
        }
        templateMap[r.templateKey].teksten[r.taal] = { onderwerp: r.onderwerp, body: r.body };
      }
      const templates = Object.values(templateMap);
      // Voeg standaard templates toe als ze nog niet bestaan
      const standaardKeys = ["uitnodiging", "herinnering", "resultaten", "accreditatie"];
      for (const k of standaardKeys) {
        if (!templateMap[k]) {
          templates.push({ templateKey: k, teksten: {}, isStandaard: true });
        }
      }
      return res.json({ talen: ["nl", "fr", "en", "es", "ru"], templates });
    } catch (e) {
      return res.status(500).json({ error: "Ophalen mislukt." });
    }
  });

  // PUT /api/admin/mailteksten/:key/:taal
  app.put("/api/admin/mailteksten/:key/:taal", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const sq = getSqlite(db, storage);
    if (!sq) return res.status(500).json({ error: "DB niet beschikbaar." });
    try {
      const { key, taal } = req.params;
      const { onderwerp, body } = req.body;
      sq.prepare(`
        INSERT INTO mail_teksten (templateKey, taal, onderwerp, body, bijgewerkt_op)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(templateKey, taal) DO UPDATE SET onderwerp = excluded.onderwerp, body = excluded.body, bijgewerkt_op = excluded.bijgewerkt_op
      `).run(key, taal, onderwerp ?? "", body ?? "");
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Opslaan mislukt." });
    }
  });

  // GET /api/admin/mailhuisstijl
  app.get("/api/admin/mailhuisstijl", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const sq = getSqlite(db, storage);
    if (!sq) return res.json({ logo: "", accentKleur: "#e87c20", afzender: "TaPasCity <noreply@tapascity.com>" });
    try {
      const row = sq.prepare("SELECT * FROM mail_huisstijl WHERE id = 1").get() as any;
      return res.json(row ?? { logo: "", accentKleur: "#e87c20", afzender: "TaPasCity <noreply@tapascity.com>" });
    } catch (e) {
      return res.status(500).json({ error: "Ophalen mislukt." });
    }
  });

  // PUT /api/admin/mailhuisstijl
  app.put("/api/admin/mailhuisstijl", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const sq = getSqlite(db, storage);
    if (!sq) return res.status(500).json({ error: "DB niet beschikbaar." });
    try {
      const { logo, accentKleur, afzender } = req.body;
      sq.prepare(`
        UPDATE mail_huisstijl SET logo = ?, accentKleur = ?, afzender = ?, bijgewerkt_op = datetime('now') WHERE id = 1
      `).run(logo ?? "", accentKleur ?? "#e87c20", afzender ?? "TaPasCity <noreply@tapascity.com>");
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Opslaan mislukt." });
    }
  });

  // PUT /api/admin/mailhuisstijl/org/:id — whitelabel per organisatie
  app.put("/api/admin/mailhuisstijl/org/:id", (req, res) => {
    if (!requireAdmin(req, res)) return;
    // Sla op als JSON in organisaties tabel mail_huisstijl kolom (indien aanwezig)
    // Voor nu: simpele bevestiging
    return res.json({ ok: true });
  });
}

// =========================================================================
// Hulpfuncties
// =========================================================================

function tryParseJson(val: string, fallback: any): any {
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function instrumentNaam(id: string): string {
  const namen: Record<string, string> = {
    t4p: "T4P Business Kompas",
    t4s: "T4Students",
    t4r: "T4Recruitment",
    teamscan: "TaPas Teamscan",
    "2minscan": "2MinScan",
    hdd: "HDD Rapport",
    impact: "Impact Assessment",
  };
  return namen[id] ?? id;
}

function toVerdelingRij(r: any): any {
  return {
    sleutel: r.sleutel,
    label: r.label ?? r.sleutel,
    aantal: r.aantal,
    onderdrukt: false,
    benchmarkPct: r.benchmarkPct ?? null,
  };
}

function parseSessies(raw: string | null): any[] {
  if (!raw) return [];
  return raw.split("|").filter(Boolean).map((s) => {
    const [id, startdatum, format, locatie] = s.split(":");
    return { id: Number(id), startdatum, format, locatie: locatie ?? "" };
  });
}

function leegInzichtoverzicht(as: string, organisatie: any): any {
  return {
    as,
    organisatie,
    gegenereerdOp: new Date().toISOString(),
    totalen: { afnamesTotaal: 0, afnamesVoltooid: 0, organisaties: 0, deelnemers: 0 },
    gender: [], roleLevel: [], sector: [], land: [], organisatieType: [], instrument: [],
    evolutie: [],
    coachNetwerk: { totaalActief: 0, perLand: [], perRegio: [], perAccreditatie: [] },
    drempels: {
      factoranalyse: { benodigd: 300, huidig: 0, gehaald: false },
      radar: { benodigd: 150, huidig: 0, gehaald: false },
      brug: { benodigd: 500, huidig: 0, gehaald: false },
    },
  };
}
