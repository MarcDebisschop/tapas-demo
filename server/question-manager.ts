/**
 * Question Manager — prior-beheerder beheert vragen van alle instrumenten
 *
 * Architectuur:
 *  - Vragen worden LIVE uit instrument.json / itembank.json / library.ts geladen.
 *  - Aanpassingen worden opgeslagen in een SQLite-tabel `vraag_overschrijvingen`.
 *  - Bij elke afname wordt eerst gekeken of er een override bestaat; zo ja, wint
 *    die boven de originele tekst — volledig transparant voor de scorer.
 *  - Beveiliging: enkel is_prior=true beheerders mogen lezen + schrijven.
 *  - Audit trail: elke wijziging slaat wie + wanneer op.
 *
 * Ondersteunde instrumenten (v2 — uitgebreid):
 *   tapas-t4p          → server/data/instrument.json       (T4P Business Kompas)
 *   tapas-teamscan     → server/teamscan/itembank.json      (TaPas Teamscan)
 *   tapas-t4recruitment→ server/t4r/library.ts              (T4Recruitment)
 *   tapas-driverscan   → server/data/instrument.json (10 forced-choice driver-blokken) (Driver-scan / Kahler-drivers)
 *   tapas-t4students   → interne definitie (studiekompas)   (T4Students)
 *   tapas-t4sports     → server/data/t4sports-modules.json  (T4Sports M1/M2/M3)
 *
 * Talen: nl, fr, en, es, ru
 *
 * Wijzigingen t.o.v. v1:
 *  - 3 nieuwe instrument-loaders (T4Recruitment, 2MinScan, T4Students)
 *  - CSV-export van volledig audit log (GET /api/admin/vraagbeheer/export/csv)
 *  - getVraagTekst() blijft de publieke integratie-interface voor scoring/afname
 */

import { type Request, type Response } from "express";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { storage, db } from "./storage";
import { MODULES as T4R_MODULES } from "./t4r/library";
import { t4oInstrument } from "./t4organizations/instrument";
import { T4KIDS_ITEMS_FLAT } from "./t4kids/itembank";
import { t4studentsItems } from "./t4students/instrument";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VraagItem {
  itemId: string;       // bijv. "1.1" of "ts-B_lencioni-1" of "t4r-M5-BS-1"
  instrument: string;   // "tapas-t4p" | "tapas-teamscan" | "tapas-t4recruitment" | ...
  family?: string;
  construct?: string;
  tekst: Record<string, string>;  // { nl, fr, en, es, ru }
  heeftOverride: boolean;
  origineel?: Record<string, string>;
}

// ─── Helper: prior-check middleware ──────────────────────────────────────────

async function requirePrior(req: Request, res: Response, next: Function) {
  const adminId = (req.session as any)?.adminId;
  if (!adminId) return res.status(401).json({ error: "Niet ingelogd." });
  const beheerder = await storage.getBeheerder(Number(adminId));
  if (!beheerder || !beheerder.isPrior) {
    return res.status(403).json({ error: "Enkel prior-beheerders kunnen vragen beheren." });
  }
  (req as any).beheerder = beheerder;
  next();
}

// ─── Items laden uit de ruwe JSON-bestanden / TypeScript-definities ───────────

/** T4P Business Kompas — laadt uit server/data/instrument.json */
function laadT4PItems(): VraagItem[] {
  try {
    const pad = join(process.cwd(), "server/data/instrument.json");
    const data = JSON.parse(readFileSync(pad, "utf-8"));
    const items: VraagItem[] = [];
    for (const sec of data.sections ?? []) {
      for (const block of sec.blocks ?? []) {
        for (const item of block.items ?? []) {
          const tekst: Record<string, string> = {};
          if (typeof item.text === "string") {
            tekst.nl = item.text;
          } else {
            Object.assign(tekst, item.text ?? {});
          }
          items.push({
            itemId: item.id ?? `${block.blockIndex}-${item.pos}`,
            instrument: "tapas-t4p",
            family: item.family,
            construct: item.construct,
            tekst,
            heeftOverride: false,
          });
        }
      }
    }
    // Verbindingsvragen (deel 2)
    for (const cq of data.connectionQuestions ?? []) {
      const tekst: Record<string, string> = {};
      if (typeof cq.text === "string") tekst.nl = cq.text;
      else Object.assign(tekst, cq.text ?? {});
      items.push({
        itemId: `deel2-${cq.id}`,
        instrument: "tapas-t4p",
        family: "Verbindingsvragen",
        construct: cq.scale,
        tekst,
        heeftOverride: false,
      });
    }
    return items;
  } catch (e) {
    console.error("[QM] Fout bij laden T4P items:", e);
    return [];
  }
}

/** TaPas Teamscan — laadt uit server/teamscan/itembank.json */
function laadTeamscanItems(): VraagItem[] {
  try {
    const pad = join(process.cwd(), "server/teamscan/itembank.json");
    const data = JSON.parse(readFileSync(pad, "utf-8"));
    const items: VraagItem[] = [];

    // Structuurvariant 1: data.blokken is een object (map van blok-ID naar blokdata)
    if (data.blokken && typeof data.blokken === "object" && !Array.isArray(data.blokken)) {
      for (const [blokKey, blok] of Object.entries<any>(data.blokken)) {
        const blokNaam = blok.naam ?? blokKey;
        const blokItems: any[] = blok.items ?? blok.elementen ?? [];
        for (const item of blokItems) {
          const tekst: Record<string, string> = {};
          if (typeof item.tekst === "string") tekst.nl = item.tekst;
          else if (typeof item.tekst === "object") Object.assign(tekst, item.tekst ?? {});
          if (!tekst.nl && typeof item.stelling === "string") tekst.nl = item.stelling;
          items.push({
            itemId: `ts-${blokKey}-${item.id}`,
            instrument: "tapas-teamscan",
            family: blok.pijler ?? blokNaam,
            construct: item.construct ?? item.dimensie ?? item.pijler,
            tekst,
            heeftOverride: false,
          });
        }
      }
    }

    // Structuurvariant 2: data.blokken is een array
    if (data.blokken && Array.isArray(data.blokken)) {
      for (const blok of data.blokken) {
        for (const item of blok.items ?? []) {
          const tekst: Record<string, string> = {};
          if (typeof item.tekst === "string") tekst.nl = item.tekst;
          else Object.assign(tekst, item.tekst ?? {});
          items.push({
            itemId: `ts-${blok.blokId ?? blok.id}-${item.id}`,
            instrument: "tapas-teamscan",
            family: blok.pijler ?? blok.naam ?? "Teamscan",
            construct: item.construct ?? item.dimensie,
            tekst,
            heeftOverride: false,
          });
        }
      }
    }

    // Fundamentpijler (aparte sleutel in sommige versies)
    if (data.fundamentPijler?.items) {
      for (const itemId of data.fundamentPijler.items) {
        // Louter registratie als er geen apart tekst-object is
        items.push({
          itemId: `ts-fundament-${itemId}`,
          instrument: "tapas-teamscan",
          family: "Fundament",
          construct: undefined,
          tekst: { nl: `Fundament-item ${itemId}` },
          heeftOverride: false,
        });
      }
    }

    return items;
  } catch (e) {
    console.error("[QM] Fout bij laden Teamscan items:", e);
    return [];
  }
}

/**
 * T4Recruitment — laadt uit server/t4r/library.ts (MODULES array).
 * Items worden in-memory geladen via de al geïmporteerde MODULES constante.
 * family = module.key (context / rol / drivers / foci / versnellers / zelfbeeld)
 * construct = item.cluster
 */
function laadT4RItems(): VraagItem[] {
  try {
    const items: VraagItem[] = [];
    for (const mod of T4R_MODULES) {
      // Werkcontexten als aparte items (module 4 / selectie)
      for (const wc of mod.workContexts ?? []) {
        items.push({
          itemId: `t4r-WC-${wc.id}`,
          instrument: "tapas-t4recruitment",
          family: `Module ${mod.nr}: ${mod.title}`,
          construct: "Werkcontext",
          tekst: { nl: `[${wc.name}] ${wc.desc}` },
          heeftOverride: false,
        });
      }
      for (const item of mod.items) {
        items.push({
          itemId: `t4r-${item.id}`,
          instrument: "tapas-t4recruitment",
          family: `Module ${mod.nr}: ${mod.title}`,
          construct: item.cluster ?? item.type,
          tekst: { nl: item.text, ...(item.help ? { nl_help: item.help } : {}) },
          heeftOverride: false,
        });
      }
    }
    return items;
  } catch (e) {
    console.error("[QM] Fout bij laden T4Recruitment items:", e);
    return [];
  }
}

/**
 * Driver-scan — Kahler-drivers via forced-choice (Route 1).
 *
 * De Driver-scan meet de 5 Kahler-drivers via EXACT dezelfde gevalideerde
 * forced-choice driver-blokken als het T4P Business Kompas: de 10 blokken met
 * family "Drivers" (blockIndex 0..9) uit server/data/instrument.json. Het
 * vraagbeheer laadt daarom die LIVE forced-choice items (loader hieronder) —
 * volledig losgekoppeld van de "2MINSCAN"-naam.
 *
 * ── GEARCHIVEERD, NIET IN GEBRUIK ──────────────────────────────────────────
 * De onderstaande 27 Likert-items waren de oorspronkelijke stellingen-variant.
 * Route 1 gebruikt ze NIET (de Driver-scan neemt de T4P forced-choice blokken
 * af). Ze blijven hier enkel als bevroren, uitgeschakelde referentie bewaard.
 * De teksten zijn LETTERLIJK behouden (Werkprotocol Regel 4 — spelling nooit
 * corrigeren). Geen enkele loader of route verwijst nog naar deze constante.
 * family = driver-naam, construct = cluster.
 */
const ARCHIVED_DRIVERSCAN_LIKERT_ITEMS_DEF: { id: string; driver: string; cluster: string; tekst: string }[] = [
  // Be Strong
  { id: "DRV-BS-1", driver: "Be Strong", cluster: "Standvastigheid", tekst: "Ik draag mijn verantwoordelijkheid en manage mijn werk grotendeels autonoom." },
  { id: "DRV-BS-2", driver: "Be Strong", cluster: "Kalmte onder druk", tekst: "Ik blijf emotioneel stabiel en kalm, ook in stressvolle situaties." },
  { id: "DRV-BS-3", driver: "Be Strong", cluster: "Rationaliteit", tekst: "Ik redeneer rationeel en laat me niet snel meedragen door emoties." },
  { id: "DRV-BS-4", driver: "Be Strong", cluster: "Controle", tekst: "Ik houd het overzicht en voel me ongemakkelijk als anderen alles bepalen." },
  { id: "DRV-BS-5", driver: "Be Strong", cluster: "Zelfstandigheid", tekst: "Ik prefereer zelf beslissingen te nemen boven afhankelijkheid van anderen." },
  // Be Perfect
  { id: "DRV-BP-1", driver: "Be Perfect", cluster: "Nauwkeurigheid", tekst: "Ik werk nauwkeurig en wil dat alles tot in de puntjes klopt." },
  { id: "DRV-BP-2", driver: "Be Perfect", cluster: "Kwaliteitsbewustzijn", tekst: "Ik merk afwijkingen van de gewenste kwaliteit onmiddellijk op." },
  { id: "DRV-BP-3", driver: "Be Perfect", cluster: "Grondigheid", tekst: "Ik ga goed door informatie heen en lever grondig en volledig werk af." },
  { id: "DRV-BP-4", driver: "Be Perfect", cluster: "Zelfkritiek", tekst: "Ik houd hoge standaarden aan voor mezelf en word onrustig als ik ze niet haal." },
  { id: "DRV-BP-5", driver: "Be Perfect", cluster: "Precisie", tekst: "Ik neem de tijd om het goed te doen, ook als anderen snelheid verwachten." },
  // Hurry Up
  { id: "DRV-HU-1", driver: "Hurry Up", cluster: "Multitasking", tekst: "Ik beheer meerdere taken tegelijk en vind daarin een meerwaarde." },
  { id: "DRV-HU-2", driver: "Hurry Up", cluster: "Werktempo", tekst: "Ik werk snel en productief, ook onder tijdsdruk." },
  { id: "DRV-HU-3", driver: "Hurry Up", cluster: "Momentum", tekst: "Ik ga liever snel vooruit dan lang te wachten op perfectie." },
  { id: "DRV-HU-4", driver: "Hurry Up", cluster: "Activatienood", tekst: "Ik heb een hoog activatieniveau nodig om op mijn best te functioneren." },
  { id: "DRV-HU-5", driver: "Hurry Up", cluster: "Actiegerichtheid", tekst: "Rust voelt voor mij onproductief; ik wil altijd bezig zijn." },
  // Try Hard
  { id: "DRV-TH-1", driver: "Try Hard", cluster: "Prestatiedrang", tekst: "Ik stel hoge doelen en zet me voluit in om ze te bereiken." },
  { id: "DRV-TH-2", driver: "Try Hard", cluster: "Bewijsdrang", tekst: "Ik voel me aangedreven om mijn waarde te bewijzen in uitdagende situaties." },
  { id: "DRV-TH-3", driver: "Try Hard", cluster: "Volharding", tekst: "Ik geef niet snel op en blijf doorzetten tot het gewenste resultaat er is." },
  { id: "DRV-TH-4", driver: "Try Hard", cluster: "Uitdagingsdrang", tekst: "Ik gedij het best in veeleisende omgevingen waar ik mezelf moet overstijgen." },
  { id: "DRV-TH-5", driver: "Try Hard", cluster: "Ambitie", tekst: "Succes en erkenning voor mijn inzet zijn voor mij een sterke motor." },
  // Please Others
  { id: "DRV-PO-1", driver: "Please Others", cluster: "Dienstbaarheid", tekst: "Ik ben sterk gericht op de noden en wensen van anderen." },
  { id: "DRV-PO-2", driver: "Please Others", cluster: "Harmonie", tekst: "Ik zoek actief naar aanvaarding en wil disharmonie vermijden." },
  { id: "DRV-PO-3", driver: "Please Others", cluster: "Diplomatisch", tekst: "Ik formuleer feedback op een manier die anderen kan aanvaarden." },
  { id: "DRV-PO-4", driver: "Please Others", cluster: "Empathie", tekst: "Ik voel snel aan hoe anderen zich voelen en pas mijn gedrag daarop aan." },
  { id: "DRV-PO-5", driver: "Please Others", cluster: "Aanpassingsbereidheid", tekst: "Ik pas mijn werkstijl aan anderen aan om samenwerking te bevorderen." },
  // Energiebalans (open)
  { id: "DRV-OPN-1", driver: "Energiebalans", cluster: "Open reflectie", tekst: "Welke activiteiten of werksituaties geven jou structureel energie? (open vraag)" },
  { id: "DRV-OPN-2", driver: "Energiebalans", cluster: "Open reflectie", tekst: "Welke activiteiten of werksituaties kosten jou structureel energie? (open vraag)" },
];
// Onderdrukt "unused"-waarschuwingen: bewust bewaarde, uitgeschakelde referentie.
void ARCHIVED_DRIVERSCAN_LIKERT_ITEMS_DEF;

/**
 * Driver-scan loader — leest de 10 forced-choice driver-blokken (family
 * "Drivers", blockIndex 0..9) uit server/data/instrument.json. Dit zijn exact
 * de items die de Driver-scan-afname toont en die buildMainScores scoort;
 * daarmee is het vraagbeheer consistent met de effectieve afname.
 * family = "Drivers", construct = driver-naam, itemId = het instrument-item-ID.
 */
function laadDriverScanItems(): VraagItem[] {
  try {
    const pad = join(process.cwd(), "server/data/instrument.json");
    const data = JSON.parse(readFileSync(pad, "utf-8"));
    const main = (data.sections ?? []).find((s: any) => s.sectionId === "main");
    const items: VraagItem[] = [];
    for (const block of (main?.blocks ?? []) as any[]) {
      if (block.family !== "Drivers") continue;
      for (const item of (block.items ?? []) as any[]) {
        const tekst: Record<string, string> = {};
        if (typeof item.text === "string") tekst.nl = item.text;
        else Object.assign(tekst, item.text ?? {});
        items.push({
          itemId: item.id ?? `${block.blockIndex}-${item.pos}`,
          instrument: "tapas-driverscan",
          family: item.family ?? "Drivers",
          construct: item.construct,
          tekst,
          heeftOverride: false,
        });
      }
    }
    return items;
  } catch (e) {
    console.error("[QM] Fout bij laden Driver-scan items:", e);
    return [];
  }
}

/**
 * T4Students / Studiekompas.
 *
 * De items komen uit de echte itembank van het instrument
 * (server/data/t4students.json, via server/t4students/instrument.ts). Hier stond
 * eerder een tweede, met de hand geschreven lijst van 37 items met eigen id's
 * (T4S-FA-1 en verder). Die lijst kwam in geen enkele afname en in geen enkele
 * scoring voor: de scoringsmotor van het studiekompas leest de items P0, I1,
 * BE1, D1 en verder. Twee lijsten met dezelfde naam is precies de verwarring die
 * de verkeerde rapporten heeft veroorzaakt, dus is er nu één.
 *
 * Gevolg voor het vraagbeheer: een overschrijving hoort bij het item-id van het
 * instrument zelf, en werkt daardoor ook echt door in de afname
 * (server/routes/vragenlijst-t4students.ts leest dezelfde overschrijvingen).
 */
function laadT4StudentsItems(): VraagItem[] {
  try {
    return t4studentsItems().map((it) => ({
      itemId: it.id,
      instrument: "tapas-t4students",
      family: it.family,
      construct: it.construct,
      tekst: {
        nl: it.text?.nl ?? "",
        fr: it.text?.fr ?? "",
        en: it.text?.en ?? "",
      },
      heeftOverride: false,
    }));
  } catch (e) {
    console.error("[QM] T4Students items laden mislukt:", e);
    return [];
  }
}


// ─── T4Teens — Vonk-instrument ────────────────────────────────────────────────
// Bron: t4teens-demo-main.zip / T4Teens-Ontdek-jouw-vonk-Lana-volledige-keten.zip
// Items exact overgenomen uit index.html (DATA.items) + vonk_scorer.js
// Geen interpretatie — 1-op-1 extractie (Regel 4)
const T4TEENS_ITEMS_DEF: { id: string; domein: string; cluster: string; tekst: string }[] = [
  { id: "T4T-I1-1", domein: "Energie", cluster: "Batterij", tekst: "Hoe vol zit je batterij vandaag? Schuif hem naar waar jij je voelt." },
  { id: "T4T-D1-1", domein: "Drivers", cluster: "Be Perfect", tekst: "Ik wil dat iets echt klopt voordat ik het loslaat - ook al kost dat meer tijd." },
  { id: "T4T-D2-1", domein: "Drivers", cluster: "Please Others", tekst: "Ik vind het fijn als iedereen om me heen het naar zijn zin heeft, soms zet ik mezelf daarvoor opzij." },
  { id: "T4T-D3-1", domein: "Drivers", cluster: "Try Hard", tekst: "Er is iemand die ik echt ken en naar wie ik opkijk - en als ik weet dat die in mij gelooft, doe ik alles om te laten zien wat ik kan." },
  { id: "T4T-D4-1", domein: "Drivers", cluster: "Hurry Up", tekst: "Wachten en traag vooruitgaan vind ik lastig - het mag voor mij snel gaan." },
  { id: "T4T-D5-1", domein: "Drivers", cluster: "Be Strong / Please Others", tekst: "Stel: jullie moeten met de groep iets oplossen en het loopt vast. Wat doe jij het liefst?" },
  { id: "T4T-D6-1", domein: "Drivers", cluster: "Be Strong / Hurry Up", tekst: "Stel: je hebt iemand iets beloofd, maar er komt iets leukers tussen. Wat doe jij?" },
  { id: "T4T-V1-1", domein: "Talent-versnellers", cluster: "Analyse", tekst: "Ik wil eerst snappen hoe iets in elkaar zit voor ik begin - en daar krijg ik energie van." },
  { id: "T4T-V2-1", domein: "Talent-versnellers", cluster: "Coaching", tekst: "Ik leer het best als ik er met iemand over kan praten of het mag uitleggen." },
  { id: "T4T-V3-1", domein: "Talent-versnellers", cluster: "Facilitatie", tekst: "Ik help graag dat alles vlot en geordend loopt voor de groep." },
  { id: "T4T-V4-1", domein: "Talent-versnellers", cluster: "Facilitatie", tekst: "Ik wil dat wat ik doe echt iets verandert of betekent - dan zet ik door." },
  { id: "T4T-V5-1", domein: "Talent-versnellers", cluster: "Resultaat", tekst: "Ik wil vooral zien wat het oplevert; ik werk graag naar een duidelijk eindresultaat toe." },
  { id: "T4T-V6-1", domein: "Talent-versnellers", cluster: "Constructief onderscheidend", tekst: "Ik bedenk vaak een eigen, andere manier om iets aan te pakken." },
  { id: "T4T-F1-1", domein: "Talent-foci", cluster: "Bedenken/creatie", tekst: "Ik vind het leuk om nieuwe dingen te bedenken die er nog niet zijn - daar kan ik in opgaan." },
  { id: "T4T-F2-1", domein: "Talent-foci", cluster: "Uitzoeken/onderzoek", tekst: "Ik krijg er energie van om iets uit te zoeken of een probleem te ontrafelen." },
  { id: "T4T-F3-1", domein: "Talent-foci", cluster: "Doen/uitvoeren (SJT)", tekst: "Stel: er moet iets concreet gemaakt of uitgevoerd worden. Voel jij je daar goed bij?" },
  { id: "T4T-F4-1", domein: "Talent-foci", cluster: "Leren/overdragen", tekst: "Ik vind het fijn om iemand iets te leren of uit te leggen." },
  { id: "T4T-F5-1", domein: "Talent-foci", cluster: "Samenwerken (SJT)", tekst: "Stel: je mag kiezen om iets alleen of samen met anderen te doen. Waar word je blijer van?" },
  { id: "T4T-R1-1", domein: "Interesse", cluster: "Realistisch", tekst: "Dingen maken, bouwen, herstellen of met je handen en machines werken." },
  { id: "T4T-R2-1", domein: "Interesse", cluster: "Investigative", tekst: "Uitzoeken hoe iets werkt: onderzoek, computers, meten of berekenen." },
  { id: "T4T-R3-1", domein: "Interesse", cluster: "Artistiek", tekst: "Iets creatiefs doen: film, muziek, toneel, schilderen of vormgeven." },
  { id: "T4T-R4-1", domein: "Interesse", cluster: "Sociaal", tekst: "Met en voor mensen bezig zijn: helpen, verzorgen, begeleiden." },
  { id: "T4T-R5-1", domein: "Interesse", cluster: "Ondernemend", tekst: "De leiding nemen, overtuigen, iets organiseren of ondernemen." },
  { id: "T4T-R6-1", domein: "Interesse", cluster: "Conventioneel", tekst: "Orde en overzicht houden: plannen, administratie, alles op zijn plek." },
  { id: "T4T-B1-1", domein: "Betekenis", cluster: "Betekenis", tekst: "Waar zou jij iets willen betekenen voor anderen of voor de wereld?" },
];

function laadT4TeensItems(): VraagItem[] {
  return T4TEENS_ITEMS_DEF.map((d) => ({
    itemId: d.id,
    instrument: "tapas-t4teens",
    family: d.domein,
    construct: d.cluster,
    tekst: { nl: d.tekst },
    heeftOverride: false,
  }));
}

// ─── T4Kids — Ontdekkingsreis (10-13 jaar) ────────────────────────────────────
// Bron: server/t4kids/itembank.ts (één bron van waarheid — geen duplicatie).
// De platte itemlijst (interesseparen + archetypen + stellingen) wordt hier
// enkel gemapt naar het VraagItem-formaat voor de question-manager.
const T4KIDS_ITEMS_DEF = T4KIDS_ITEMS_FLAT;

function laadT4KidsItems(): VraagItem[] {
  return T4KIDS_ITEMS_DEF.map((d) => ({
    itemId: d.id,
    instrument: "tapas-t4kids",
    family: d.domein,
    construct: d.cluster,
    tekst: { nl: d.tekst },
    heeftOverride: false,
  }));
}

// ─── SQLite voor overschrijvingen (lazy init) ─────────────────────────────────

function getSqlite() {
  return (db as any)._db ?? (storage as any).sqlite ?? null;
}

function ensureOverrideTable() {
  try {
    const sqlite = getSqlite();
    if (sqlite) {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS vraag_overschrijvingen (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          instrument TEXT NOT NULL,
          item_id TEXT NOT NULL,
          taal TEXT NOT NULL,
          tekst TEXT NOT NULL,
          gewijzigd_door TEXT NOT NULL,
          gewijzigd_op TEXT NOT NULL,
          UNIQUE(instrument, item_id, taal)
        )
      `);
    }
  } catch (e) {
    console.error("[QM] Tabel aanmaken mislukt:", e);
  }
}

function getOverrides(instrument: string): Map<string, Record<string, string>> {
  ensureOverrideTable();
  const result = new Map<string, Record<string, string>>();
  try {
    const sqlite = getSqlite();
    if (!sqlite) return result;
    const rows = sqlite.prepare(
      "SELECT item_id, taal, tekst FROM vraag_overschrijvingen WHERE instrument = ?"
    ).all(instrument) as { item_id: string; taal: string; tekst: string }[];
    for (const row of rows) {
      if (!result.has(row.item_id)) result.set(row.item_id, {});
      result.get(row.item_id)![row.taal] = row.tekst;
    }
  } catch {}
  return result;
}

function saveOverride(
  instrument: string,
  itemId: string,
  taal: string,
  tekst: string,
  gewijzigdDoor: string
) {
  ensureOverrideTable();
  try {
    const sqlite = getSqlite();
    if (!sqlite) throw new Error("geen sqlite");
    const now = new Date().toISOString();
    sqlite.prepare(`
      INSERT INTO vraag_overschrijvingen (instrument, item_id, taal, tekst, gewijzigd_door, gewijzigd_op)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(instrument, item_id, taal) DO UPDATE SET
        tekst = excluded.tekst,
        gewijzigd_door = excluded.gewijzigd_door,
        gewijzigd_op = excluded.gewijzigd_op
    `).run(instrument, itemId, taal, tekst, gewijzigdDoor, now);
    return true;
  } catch (e) {
    console.error("[QM] Override opslaan mislukt:", e);
    return false;
  }
}

function deleteOverride(instrument: string, itemId: string, taal: string) {
  ensureOverrideTable();
  try {
    const sqlite = getSqlite();
    if (!sqlite) return false;
    sqlite.prepare(
      "DELETE FROM vraag_overschrijvingen WHERE instrument = ? AND item_id = ? AND taal = ?"
    ).run(instrument, itemId, taal);
    return true;
  } catch { return false; }
}

function getAuditLog(instrument: string, itemId?: string) {
  ensureOverrideTable();
  try {
    const sqlite = getSqlite();
    if (!sqlite) return [];
    if (itemId) {
      return sqlite.prepare(
        "SELECT taal, tekst, gewijzigd_door, gewijzigd_op FROM vraag_overschrijvingen WHERE instrument = ? AND item_id = ? ORDER BY gewijzigd_op DESC"
      ).all(instrument, itemId);
    } else {
      // Volledig audit log voor een instrument (voor CSV export)
      return sqlite.prepare(
        "SELECT item_id, taal, tekst, gewijzigd_door, gewijzigd_op FROM vraag_overschrijvingen WHERE instrument = ? ORDER BY gewijzigd_op DESC"
      ).all(instrument);
    }
  } catch { return []; }
}

/** Geeft alle instrumenten terug (voor de "export alles" optie). */
function getAllAuditLog() {
  ensureOverrideTable();
  try {
    const sqlite = getSqlite();
    if (!sqlite) return [];
    return sqlite.prepare(
      "SELECT instrument, item_id, taal, tekst, gewijzigd_door, gewijzigd_op FROM vraag_overschrijvingen ORDER BY gewijzigd_op DESC"
    ).all();
  } catch { return []; }
}

// ─── CSV helper ───────────────────────────────────────────────────────────────

function escapeCSV(val: string | null | undefined): string {
  if (val == null) return '""';
  const s = String(val).replace(/"/g, '""');
  return `"${s}"`;
}

function logToCSV(rows: any[]): string {
  const header = ["instrument", "item_id", "taal", "tekst", "gewijzigd_door", "gewijzigd_op"].join(";");
  const lines = rows.map((r) =>
    [
      escapeCSV(r.instrument),
      escapeCSV(r.item_id),
      escapeCSV(r.taal),
      escapeCSV(r.tekst),
      escapeCSV(r.gewijzigd_door),
      escapeCSV(r.gewijzigd_op),
    ].join(";")
  );
  return [header, ...lines].join("\r\n");
}

// ─── Instrument-dispatcher ────────────────────────────────────────────────────

/** T4Sports Modules — laadt M1 (ACSI-28), M2 (DFS-2/FSS-2), M3 (AIMS-7) uit server/data/t4sports-modules.json */
function laadT4SportsModuleItems(): VraagItem[] {
  try {
    const pad = join(process.cwd(), "server/data/t4sports-modules.json");
    const data = JSON.parse(readFileSync(pad, "utf-8"));
    const modules = data.modules as Record<string, any>;
    const items: VraagItem[] = [];
    const moduleNamen: Record<string, string> = {
      M1: "ACSI-28",
      M2: "DFS-2/FSS-2",
      M3: "AIMS-7",
    };
    for (const [moduleKey, module] of Object.entries(modules)) {
      const moduleNaam = moduleNamen[moduleKey] ?? moduleKey;
      for (const item of (module.items ?? []) as any[]) {
        items.push({
          itemId: `t4sports-${moduleKey}-${item.nr}`,
          instrument: "tapas-t4sports",
          family: moduleNaam,
          construct: item.schaal ?? undefined,
          tekst: { nl: item.tekst },
          heeftOverride: false,
        });
      }
    }
    return items;
  } catch (e) {
    console.error("[QM] T4Sports modules laden mislukt:", e);
    return [];
  }
}

// ─── T4Sports Basis — 136 basisitems (Drivers, Talent-foci, Talent-versnellers) ────────────────
// Bron: server/data/t4sports.json — identieke structuur als T4P Business Kompas
// Loaders parallel aan laadT4PItems() — geen interpretatie, 1-op-1 extractie
function laadT4SportsBasisItems(): VraagItem[] {
  try {
    const pad = join(process.cwd(), "server/data/t4sports.json");
    const data = JSON.parse(readFileSync(pad, "utf-8"));
    const items: VraagItem[] = [];
    for (const section of (data.sections ?? []) as any[]) {
      for (const block of (section.blocks ?? []) as any[]) {
        const family: string = block.family ?? "";
        for (const item of (block.items ?? []) as any[]) {
          items.push({
            itemId: item.id ?? `t4sports-b${block.blockIndex}-${item.pos}`,
            instrument: "tapas-t4sports-basis",
            family,
            construct: item.construct ?? undefined,
            tekst: { nl: (item.text?.nl ?? item.tekst?.nl ?? item.tekst ?? "") as string },
            heeftOverride: false,
          });
        }
      }
    }
    return items;
  } catch (e) {
    console.error("[QM] T4Sports basis laden mislukt:", e);
    return [];
  }
}

// ─── TaPas 4 Organizations — 3-ringen organisatie-instrument ─────────────────
// Bron: server/t4organizations/instrument.ts (t4oInstrument.items).
// Geen interpretatie, geen duplicatie — de autoritatieve itembron wordt
// rechtstreeks hergebruikt (Regel 1 + Regel 4). Elk item is meertalig via de
// override-tabel bewerkbaar; de originele prompt staat enkel in het nl-veld.
// family = niveau + ring-samenstelling; construct = dimensie (vermogen).
const T4O_RING_LABEL: Record<string, string> = {
  binnen: "R1 leiding",
  midden: "R2 medewerkers",
  buiten: "R3 stakeholders",
};

function laadT4OrganizationsItems(): VraagItem[] {
  try {
    return t4oInstrument.items.map((it) => {
      const ringen = (it.rings ?? []).map((r) => T4O_RING_LABEL[r] ?? r).join(" · ");
      return {
        itemId: it.id,
        instrument: "tapas-t4organizations",
        family: `${it.niveau} — ${ringen}`,
        construct: it.dimensie,
        tekst: { nl: it.prompt?.nl ?? "" },
        heeftOverride: false,
      } as VraagItem;
    });
  } catch (e) {
    console.error("[QM] T4Organizations items laden mislukt:", e);
    return [];
  }
}

const INSTRUMENT_LOADERS: Record<string, () => VraagItem[]> = {
  "tapas-t4p":            laadT4PItems,
  "tapas-teamscan":       laadTeamscanItems,
  "tapas-t4recruitment":  laadT4RItems,
  "tapas-driverscan":     laadDriverScanItems,
  "tapas-t4students":     laadT4StudentsItems,
  "tapas-t4teens":        laadT4TeensItems,
  "tapas-t4kids":         laadT4KidsItems,
  "tapas-t4sports":       laadT4SportsModuleItems,
  "tapas-t4sports-basis": laadT4SportsBasisItems,
  "tapas-t4organizations": laadT4OrganizationsItems,
};

const BEKENDE_INSTRUMENTEN = Object.keys(INSTRUMENT_LOADERS);

// Additief (T4Students-rapportgenerator): geeft de itembank van een instrument
// terug via de bestaande loaders. Bestaand gedrag ongewijzigd — enkel een
// lees-helper zodat nieuwe modules de items niet hoeven te dupliceren.
export function laadInstrumentItems(instrument: string): VraagItem[] {
  const loader = INSTRUMENT_LOADERS[instrument];
  return loader ? loader() : [];
}

// ─── Route builder ────────────────────────────────────────────────────────────

export function buildQuestionManagerRoutes(app: any) {

  // ── CSV export van volledig audit log ─────────────────────────────────────
  // GET /api/admin/vraagbeheer/export/csv?instrument=tapas-t4p
  // Zonder ?instrument= exporteert het ALLE instrumenten.
  app.get("/api/admin/vraagbeheer/export/csv", requirePrior, async (req: Request, res: Response) => {
    const inst = (req.query.instrument as string) ?? "";
    let rows: any[];
    if (inst && BEKENDE_INSTRUMENTEN.includes(inst)) {
      rows = getAuditLog(inst) as any[];
      // voeg instrument-kolom toe voor uniformiteit
      rows = rows.map((r: any) => ({ instrument: inst, ...r }));
    } else {
      rows = getAllAuditLog() as any[];
    }
    const csv = logToCSV(rows);
    const filename = inst
      ? `vraagbeheer-${inst}-${new Date().toISOString().slice(0, 10)}.csv`
      : `vraagbeheer-alle-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("\uFEFF" + csv); // BOM voor Excel-compatibiliteit
  });

  // ── Lijst alle vragen op voor een instrument ──────────────────────────────
  app.get("/api/admin/vraagbeheer/:instrument", requirePrior, async (req: Request, res: Response) => {
    const instrument = req.params.instrument as string;
    const zoek = ((req.query.q as string | undefined) ?? "").toLowerCase();

    const loader = INSTRUMENT_LOADERS[instrument];
    if (!loader) {
      return res.status(404).json({
        error: `Onbekend instrument. Kies uit: ${BEKENDE_INSTRUMENTEN.join(", ")}`,
      });
    }

    const items = loader();
    const overrides = getOverrides(instrument);

    // Overrides mergen
    for (const item of items) {
      const ov = overrides.get(item.itemId);
      if (ov && Object.keys(ov).length > 0) {
        item.origineel = { ...item.tekst };
        Object.assign(item.tekst, ov);
        item.heeftOverride = true;
      }
    }

    // Zoekfilter
    let gefilterd = items;
    if (zoek) {
      gefilterd = items.filter((it: VraagItem) =>
        Object.values(it.tekst).some((t: string) => t.toLowerCase().includes(zoek)) ||
        (it.construct ?? "").toLowerCase().includes(zoek) ||
        (it.family ?? "").toLowerCase().includes(zoek) ||
        it.itemId.toLowerCase().includes(zoek)
      );
    }

    res.json({
      instrument,
      totaal: items.length,
      aantalOverrides: items.filter(i => i.heeftOverride).length,
      items: gefilterd,
    });
  });

  // ── Sla één override op voor één taal ─────────────────────────────────────
  app.put("/api/admin/vraagbeheer/:instrument/:itemId", requirePrior, async (req: Request, res: Response) => {
    const instrument = req.params.instrument as string;
    const itemId = req.params.itemId as string;
    const { taal, tekst } = req.body as { taal: string; tekst: string };
    const beheerder = (req as any).beheerder;

    if (!INSTRUMENT_LOADERS[instrument]) {
      return res.status(404).json({ error: "Onbekend instrument." });
    }
    if (!taal || !tekst?.trim()) {
      return res.status(400).json({ error: "taal en tekst zijn verplicht." });
    }
    const geldige_talen = ["nl", "fr", "en", "es", "ru"];
    if (!geldige_talen.includes(taal)) {
      return res.status(400).json({ error: `Ongeldige taal. Kies uit: ${geldige_talen.join(", ")}` });
    }

    const ok = saveOverride(instrument, itemId, taal, tekst.trim(), beheerder.email);
    if (!ok) return res.status(500).json({ error: "Opslaan mislukt." });

    res.json({ ok: true, instrument, itemId, taal, tekst: tekst.trim() });
  });

  // ── Herstel originele tekst (verwijder override voor één taal) ────────────
  app.delete("/api/admin/vraagbeheer/:instrument/:itemId/:taal", requirePrior, async (req: Request, res: Response) => {
    const instrument = req.params.instrument as string;
    const itemId = req.params.itemId as string;
    const taal = req.params.taal as string;
    const ok = deleteOverride(instrument, itemId, taal);
    res.json({ ok, instrument, itemId, taal });
  });

  // ── Audit log voor één item ───────────────────────────────────────────────
  app.get("/api/admin/vraagbeheer/:instrument/:itemId/log", requirePrior, async (req: Request, res: Response) => {
    const instrument = req.params.instrument as string;
    const itemId = req.params.itemId as string;
    const log = getAuditLog(instrument, itemId);
    res.json({ instrument, itemId, log });
  });
}

// ─── Export: override ophalen voor gebruik in scoring/afname ──────────────────
//
// Integratiepunt voor de scoring-engine en de instrument-view (clientInstrumentVan):
//  - Roep getVraagTekst() aan op het moment dat item-tekst naar de client gaat.
//  - instrument: "tapas-t4p" | "tapas-teamscan" | "tapas-t4recruitment" | ...
//  - itemId: het item-ID zoals geregistreerd in laadXxxItems() hierboven.
//  - taal: "nl" | "fr" | "en" | "es" | "ru"
//  - origineel: de ongewijzigde tekst die anders zou worden gebruikt.
//
// Zie instrument.ts → clientInstrumentVan() voor de koppeling met T4P.
// Zie teamscan/routes.ts → /api/teamscan/itembank voor de teamscan-koppeling.

export function getVraagTekst(instrument: string, itemId: string, taal: string, origineel: string): string {
  const overrides = getOverrides(instrument);
  const ov = overrides.get(itemId);
  if (ov && ov[taal]) return ov[taal];
  return origineel;
}

/**
 * Exporteer de volledige override-map voor een instrument.
 * Gebruik in afname-routes om item-teksten te patchen vóór verzending naar de client.
 * Retourneert Map<itemId, Record<taal, tekst>>.
 */
export function getOverridesMap(instrument: string): Map<string, Record<string, string>> {
  return getOverrides(instrument);
}
