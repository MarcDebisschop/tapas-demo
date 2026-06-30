/**
 * server/routes/webinars.ts
 *
 * Domeinrouter: Webinar Ecosysteem (TaPas Terras / Buiten Terras).
 * In de huidige demo-versie: in-memory data, geen database-persistentie.
 * De tabel kan later worden toegevoegd aan shared/schema.ts.
 *
 * Routes:
 *   GET  /api/webinars                          — alle webinars (admin-overzicht)
 *   GET  /api/webinars/mijn                     — komende webinars (deelnemersview)
 *   GET  /api/webinars/archief                  — afgeronde webinars + zoekfilter
 *   GET  /api/webinars/mijn-topics              — ingediende topic-voorstellen
 *   POST /api/webinars                          — webinar aanmaken (admin)
 *   POST /api/webinars/topics                   — topic voorstellen (practitioner)
 *   POST /api/webinars/:id/inschrijven          — inschrijven
 *   POST /api/webinars/:id/checkin              — check-in bij start
 *   POST /api/webinars/:id/rating               — beoordeling na afloop
 *   GET  /api/webinars/admin/aanwezigheid/:id   — aanwezigheidslijst (admin)
 *   GET  /api/webinars/admin/rapport            — jaaroverzicht (admin)
 */

import type { Express } from "express";

// ---------------------------------------------------------------------------
// Demo seed-data (2 webinars zoals Marc ze kende)
// ---------------------------------------------------------------------------
let webinarId = 3;

const WEBINARS: any[] = [
  {
    id: 1,
    titel: "Talent in actie — van profiel naar praktijk",
    datum: "2026-09-18T19:00:00.000Z",
    duur_minuten: 90,
    type: "must",
    status: "gepland",
    thema: "T4P Business Kompas",
    instrument: "T4P Business Kompas",
    beschrijving:
      "Een interactieve sessie waarbij coaches en HR-professionals leren hoe ze de TaPas-profielen vertalen naar concrete teamgesprekken, loopbaanbegeleiding en selectieprocedures.",
    ingeschreven: 12,
    aanwezig: 0,
    gemRating: null,
  },
  {
    id: 2,
    titel: "Drivers in het coachgesprek — herkennen en begeleiden",
    datum: "2026-10-09T19:00:00.000Z",
    duur_minuten: 75,
    type: "must",
    status: "gepland",
    thema: "Drivers & coaching",
    instrument: "T4P Business Kompas",
    beschrijving:
      "Verdiepingssessie over de vijf drivers (Kahler-model) in de coachpraktijk: hoe herken je de actieve driver bij een coachee, en hoe zet je de driver om van rem naar gaspedaal?",
    ingeschreven: 8,
    aanwezig: 0,
    gemRating: null,
  },
];

const ARCHIEF: any[] = [
  {
    id: 0,
    titel: "Introductie TaPas-methodologie",
    datum: "2026-05-15T18:30:00.000Z",
    duur_minuten: 60,
    type: "must",
    status: "afgerond",
    thema: "Methodologie",
    instrument: "",
    beschrijving: "Introductiesessie: wat is TaPas, hoe werkt het model en wie zijn de gebruikers?",
    ingeschreven: 24,
    aanwezig: 21,
    gemRating: 4.6,
  },
];

let topics: any[] = [];

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerWebinarRoutes(app: Express): void {
  // Alle webinars — admin-overzicht
  app.get("/api/webinars", (_req, res) => {
    res.json([...WEBINARS, ...ARCHIEF]);
  });

  // Komende webinars — deelnemersview
  app.get("/api/webinars/mijn", (_req, res) => {
    const nu = new Date().toISOString();
    res.json(WEBINARS.filter((w) => w.datum > nu || w.status === "gepland" || w.status === "live"));
  });

  // Archief + zoekfilter
  app.get("/api/webinars/archief", (req, res) => {
    const q = (req.query.q as string ?? "").toLowerCase().trim();
    const lijst = [...ARCHIEF, ...WEBINARS.filter((w) => w.status === "afgerond")];
    if (!q) return res.json(lijst);
    res.json(
      lijst.filter(
        (w) =>
          w.titel.toLowerCase().includes(q) ||
          (w.thema ?? "").toLowerCase().includes(q) ||
          (w.beschrijving ?? "").toLowerCase().includes(q),
      ),
    );
  });

  // Topic-voorstellen van practitioners
  app.get("/api/webinars/mijn-topics", (_req, res) => {
    res.json(topics);
  });

  // Webinar aanmaken (admin)
  app.post("/api/webinars", (req, res) => {
    const { titel, datum, type, beschrijving, thema, instrument, duur_minuten } = req.body ?? {};
    if (!titel || !datum) {
      return res.status(400).json({ error: "titel en datum zijn verplicht" });
    }
    const w = {
      id: webinarId++,
      titel,
      datum,
      duur_minuten: Number(duur_minuten) || 60,
      type: type || "facultatief",
      status: "gepland",
      thema: thema || "",
      instrument: instrument || "",
      beschrijving: beschrijving || "",
      ingeschreven: 0,
      aanwezig: 0,
      gemRating: null,
    };
    WEBINARS.push(w);
    res.status(201).json(w);
  });

  // Topic voorstellen
  app.post("/api/webinars/topics", (req, res) => {
    const { titel, beschrijving, thema, instrument, gewenste_datum } = req.body ?? {};
    if (!titel) return res.status(400).json({ error: "titel is verplicht" });
    const t = {
      id: topics.length + 1,
      titel,
      beschrijving: beschrijving || "",
      thema: thema || "",
      instrument: instrument || "",
      gewenste_datum: gewenste_datum || null,
      status: "ingediend",
      ingediendOp: new Date().toISOString(),
    };
    topics.push(t);
    res.status(201).json(t);
  });

  // Inschrijven
  app.post("/api/webinars/:id/inschrijven", (req, res) => {
    const id = Number(req.params.id);
    const w = [...WEBINARS, ...ARCHIEF].find((x) => x.id === id);
    if (!w) return res.status(404).json({ error: "Webinar niet gevonden" });
    w.ingeschreven = (w.ingeschreven ?? 0) + 1;
    res.json({ ok: true, webinar: w });
  });

  // Check-in
  app.post("/api/webinars/:id/checkin", (req, res) => {
    const id = Number(req.params.id);
    const w = [...WEBINARS, ...ARCHIEF].find((x) => x.id === id);
    if (!w) return res.status(404).json({ error: "Webinar niet gevonden" });
    w.aanwezig = (w.aanwezig ?? 0) + 1;
    res.json({ ok: true, webinar: w });
  });

  // Beoordeling na afloop
  app.post("/api/webinars/:id/rating", (req, res) => {
    const id = Number(req.params.id);
    const rating = Number(req.body?.rating);
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "rating moet 1-5 zijn" });
    }
    const w = [...WEBINARS, ...ARCHIEF].find((x) => x.id === id);
    if (!w) return res.status(404).json({ error: "Webinar niet gevonden" });
    // Demo: simpel gemiddelde (1 nieuwe stem)
    const huidig = w.gemRating ?? rating;
    w.gemRating = Math.round(((huidig + rating) / 2) * 10) / 10;
    res.json({ ok: true, gemRating: w.gemRating });
  });

  // Admin: aanwezigheidslijst (demo: leeg)
  app.get("/api/webinars/admin/aanwezigheid/:id", (req, res) => {
    const id = Number(req.params.id);
    const w = [...WEBINARS, ...ARCHIEF].find((x) => x.id === id);
    if (!w) return res.status(404).json({ error: "Webinar niet gevonden" });
    res.json({ webinar: w, aanwezigen: [] });
  });

  // Admin: jaaroverzicht
  app.get("/api/webinars/admin/rapport", (req, res) => {
    const jaar = Number(req.query.jaar) || new Date().getFullYear();
    const alle = [...WEBINARS, ...ARCHIEF].filter(
      (w) => new Date(w.datum).getFullYear() === jaar,
    );
    res.json({
      jaar,
      totaal: alle.length,
      afgerond: alle.filter((w) => w.status === "afgerond").length,
      gepland: alle.filter((w) => w.status === "gepland").length,
      totaalInschrijvingen: alle.reduce((s, w) => s + (w.ingeschreven ?? 0), 0),
      totaalAanwezig: alle.reduce((s, w) => s + (w.aanwezig ?? 0), 0),
      gemRating:
        alle.filter((w) => w.gemRating).length
          ? Math.round(
              (alle.reduce((s, w) => s + (w.gemRating ?? 0), 0) /
                alle.filter((w) => w.gemRating).length) *
                10,
            ) / 10
          : null,
      webinars: alle,
    });
  });
}
