import type { Express } from "express";
import { storage } from "../storage";
import { insertBeheerderSchema, zetToegangSchema } from "@shared/schema";
import { PLATFORMDELEN, PLATFORMDEEL_IDS, PRIOR_ORGANISATIE } from "@shared/platformdelen";
import { zetTariefSchema, type Tarief } from "@shared/schema";
import { tarievenSamengevoegd, getDescriptor, type TariefOverride } from "../registry";

// Map een opgeslagen tarief-rij (DB) naar de merge-vorm die de registry verwacht.
function tariefNaarOverride(t: Tarief): TariefOverride {
  return {
    instrumentId: t.instrumentId,
    naam: t.naam,
    omschrijving: t.omschrijving,
    flowType: (t.flowType as TariefOverride["flowType"]) ?? "individual",
    model: (t.model as TariefOverride["model"]) ?? "per-stuk",
    creditCost: t.creditCost,
    bundelGrootte: t.bundelGrootte,
    bundelCredits: t.bundelCredits,
    isCustom: t.isCustom,
    gewijzigdDoor: t.gewijzigdDoor,
    updatedAt: t.updatedAt,
  };
}

/**
 * Toegang & accreditatie — routes (prefix /api/toegang/...).
 * ------------------------------------------------------------------
 * Governance-laag van het platform. Een PRIOR beheerder (altijd TaPasCity) is
 * de enige die andere beheerders mag toevoegen en die per platformdeel toegang
 * mag toekennen of intrekken. Onderdelen worden nooit verwijderd maar
 * gedisabled (zichtbaar maar geblokkeerd). De T4P-accreditatie is een apart
 * platformdeel ("t4p-profielen").
 *
 * NB: dit is een demo-/prototype-governance. Authenticatie van de handelende
 * beheerder gebeurt hier via een meegestuurde actor-id; in een productie-opzet
 * zou dat uit de sessie/login komen. We dwingen wel de PRIOR-regel af.
 */

// Haalt de handelende beheerder op uit body of header en verifieert dat het een
// ACTIEVE PRIOR beheerder van TaPasCity is. Geeft anders een fout terug.
async function vereisPrior(actorId: unknown): Promise<{ ok: true; naam: string } | { ok: false; status: number; error: string }> {
  const id = Number(actorId);
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, status: 400, error: "Geen geldige beheerder opgegeven (actorId ontbreekt)." };
  }
  const actor = await storage.getBeheerder(id);
  if (!actor) return { ok: false, status: 404, error: "Beheerder niet gevonden." };
  if (!actor.actief) return { ok: false, status: 403, error: "Deze beheerder is gedeactiveerd." };
  if (!actor.isPrior || actor.organisatie !== PRIOR_ORGANISATIE) {
    return { ok: false, status: 403, error: "Alleen een prior beheerder van TaPasCity mag dit doen." };
  }
  return { ok: true, naam: actor.naam };
}

export function registerToegangRoutes(app: Express): void {
  // Statische registry van platformdelen (incl. de accreditatie).
  app.get("/api/toegang/platformdelen", (_req, res) => {
    res.json(PLATFORMDELEN);
  });

  // Tarievenoverzicht per instrument — ENKEL voor een geverifieerde PRIOR
  // beheerder van TaPasCity. Toont per instrument de credit-kost, inclusief
  // bundeltarieven (bv. impact-roos: 10 stuks = 5 credits) en zelf toegevoegde
  // losse regels. Code-defaults worden samengevoegd met opgeslagen overrides.
  app.get("/api/toegang/tarieven", async (req, res) => {
    const guard = await vereisPrior(req.query?.actorId);
    if (!guard.ok) return res.status(guard.status).json({ error: guard.error });
    const rijen = await storage.listTarieven();
    res.json(tarievenSamengevoegd(rijen.map(tariefNaarOverride)));
  });

  // Tarief instellen/bewerken (upsert op instrumentId). Voor registry-
  // instrumenten is dit een override op het code-default; voor losse regels
  // (isCustom) maakt of bewerkt het een vrije tariefregel. Prior-only.
  app.post("/api/toegang/tarieven", async (req, res) => {
    const guard = await vereisPrior(req.body?.actorId);
    if (!guard.ok) return res.status(guard.status).json({ error: guard.error });

    const parsed = zetTariefSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige invoer" });
    }

    // Een bestaand registry-instrument kan nooit als "los" worden gemarkeerd, en
    // een losse regel mag geen registry-id kapen.
    const isRegistry = !!getDescriptor(parsed.data.instrumentId);
    if (parsed.data.isCustom && isRegistry) {
      return res.status(400).json({ error: "Dit id hoort bij een bestaand instrument; gebruik geen losse regel met dit id." });
    }
    const data = { ...parsed.data, isCustom: parsed.data.isCustom && !isRegistry };

    const opgeslagen = await storage.zetTarief(data, guard.naam);
    res.json(opgeslagen);
  });

  // Tarief verwijderen. Losse regels worden volledig verwijderd; een override op
  // een registry-instrument verdwijnt en het instrument valt terug op het
  // code-default tarief. Prior-only.
  app.delete("/api/toegang/tarieven/:instrumentId", async (req, res) => {
    const guard = await vereisPrior(req.query?.actorId ?? req.body?.actorId);
    if (!guard.ok) return res.status(guard.status).json({ error: guard.error });
    const ok = await storage.verwijderTarief(req.params.instrumentId);
    res.json({ verwijderd: ok });
  });

  // Alle beheerders, elk met hun toegangen per platformdeel.
  // Privacy: zonder geldige PRIOR-actor (via ?actorId=) geven we enkel een
  // minimale lijst terug (id + naam + isPrior + actief) die nodig is om de
  // actor-kiezer in de UI te vullen. E-mailadressen, organisatie, herkomst en
  // de toegang-matrix zijn alleen zichtbaar voor een geverifieerde prior
  // beheerder, zodat de open endpoint geen gevoelige gegevens lekt.
  app.get("/api/toegang/beheerders", async (req, res) => {
    const beheerders = await storage.listBeheerders();
    const guard = await vereisPrior(req.query?.actorId);

    if (!guard.ok) {
      // Minimale projectie — enkel wat de actor-kiezer nodig heeft.
      const minimaal = beheerders
        .filter((b) => b.isPrior)
        .map((b) => ({ id: b.id, naam: b.naam, isPrior: b.isPrior, actief: b.actief }));
      return res.json(minimaal);
    }

    const alle = await storage.listAlleToegangen();
    const resultaat = beheerders.map((b) => {
      const eigen = alle.filter((t) => t.beheerderId === b.id);
      const toegang: Record<string, boolean> = {};
      for (const id of PLATFORMDEEL_IDS) {
        const t = eigen.find((x) => x.platformdeel === id);
        toegang[id] = !!t?.toegestaan;
      }
      return { ...b, toegang };
    });
    res.json(resultaat);
  });

  // Nieuwe beheerder toevoegen — enkel door een prior beheerder.
  app.post("/api/toegang/beheerders", async (req, res) => {
    const guard = await vereisPrior(req.body?.actorId);
    if (!guard.ok) return res.status(guard.status).json({ error: guard.error });

    const parsed = insertBeheerderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige invoer" });
    }
    // Een prior beheerder hoort ALTIJD bij TaPasCity.
    if (parsed.data.isPrior && parsed.data.organisatie !== PRIOR_ORGANISATIE) {
      return res.status(400).json({ error: "Een prior beheerder moet bij TaPasCity horen." });
    }
    const bestaand = await storage.getBeheerderByEmail(parsed.data.email);
    if (bestaand) {
      return res.status(409).json({ error: "Er bestaat al een beheerder met dit e-mailadres." });
    }
    const nieuw = await storage.maakBeheerder({ ...parsed.data, toegevoegdDoor: guard.naam });
    res.json(nieuw);
  });

  // Beheerder (de)activeren — nooit verwijderen, enkel disablen/heractiveren.
  app.post("/api/toegang/beheerders/:id/actief", async (req, res) => {
    const guard = await vereisPrior(req.body?.actorId);
    if (!guard.ok) return res.status(guard.status).json({ error: guard.error });

    const id = Number(req.params.id);
    const doelwit = await storage.getBeheerder(id);
    if (!doelwit) return res.status(404).json({ error: "Beheerder niet gevonden." });
    // Een prior beheerder mag niet zichzelf deactiveren.
    if (id === Number(req.body?.actorId) && req.body?.actief === false) {
      return res.status(400).json({ error: "Je kunt jezelf niet deactiveren." });
    }
    const actief = req.body?.actief === true;
    const bijgewerkt = await storage.zetBeheerderActief(id, actief);
    res.json(bijgewerkt);
  });

  // Toegang tot één platformdeel toekennen of intrekken (toggle).
  app.post("/api/toegang/zet", async (req, res) => {
    const guard = await vereisPrior(req.body?.actorId);
    if (!guard.ok) return res.status(guard.status).json({ error: guard.error });

    const parsed = zetToegangSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige invoer" });
    }
    if (!PLATFORMDEEL_IDS.includes(parsed.data.platformdeel)) {
      return res.status(400).json({ error: "Onbekend platformdeel." });
    }
    const doelwit = await storage.getBeheerder(parsed.data.beheerderId);
    if (!doelwit) return res.status(404).json({ error: "Beheerder niet gevonden." });
    const t = await storage.zetToegang(
      parsed.data.beheerderId,
      parsed.data.platformdeel,
      parsed.data.toegestaan,
      guard.naam,
    );
    res.json(t);
  });
}
