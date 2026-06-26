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
 *   tapas-2minscan     → interne definitie (EG-gedragscode) (2MinScan)
 *   tapas-t4students   → interne definitie (studiekompas)   (T4Students)
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
 * 2MinScan — energetisch gedragsprofiel (EG-code instrument).
 * Structuur: 5 drivers × 5 stellingen + 1 open vraag + 1 energiebalans = 27 items.
 * Geen apart JSON-bestand — definities zijn normatief vastgelegd in het functioneel
 * ontwerp en worden hier als bevroren constante bijgehouden.
 * family = driver-naam, construct = EG-cluster
 */
const TWOMINSCAN_ITEMS_DEF: { id: string; driver: string; cluster: string; tekst: string }[] = [
  // Be Strong
  { id: "EG-BS-1", driver: "Be Strong", cluster: "Standvastigheid", tekst: "Ik draag mijn verantwoordelijkheid en manage mijn werk grotendeels autonoom." },
  { id: "EG-BS-2", driver: "Be Strong", cluster: "Kalmte onder druk", tekst: "Ik blijf emotioneel stabiel en kalm, ook in stressvolle situaties." },
  { id: "EG-BS-3", driver: "Be Strong", cluster: "Rationaliteit", tekst: "Ik redeneer rationeel en laat me niet snel meedragen door emoties." },
  { id: "EG-BS-4", driver: "Be Strong", cluster: "Controle", tekst: "Ik houd het overzicht en voel me ongemakkelijk als anderen alles bepalen." },
  { id: "EG-BS-5", driver: "Be Strong", cluster: "Zelfstandigheid", tekst: "Ik prefereer zelf beslissingen te nemen boven afhankelijkheid van anderen." },
  // Be Perfect
  { id: "EG-BP-1", driver: "Be Perfect", cluster: "Nauwkeurigheid", tekst: "Ik werk nauwkeurig en wil dat alles tot in de puntjes klopt." },
  { id: "EG-BP-2", driver: "Be Perfect", cluster: "Kwaliteitsbewustzijn", tekst: "Ik merk afwijkingen van de gewenste kwaliteit onmiddellijk op." },
  { id: "EG-BP-3", driver: "Be Perfect", cluster: "Grondigheid", tekst: "Ik ga goed door informatie heen en lever grondig en volledig werk af." },
  { id: "EG-BP-4", driver: "Be Perfect", cluster: "Zelfkritiek", tekst: "Ik houd hoge standaarden aan voor mezelf en word onrustig als ik ze niet haal." },
  { id: "EG-BP-5", driver: "Be Perfect", cluster: "Precisie", tekst: "Ik neem de tijd om het goed te doen, ook als anderen snelheid verwachten." },
  // Hurry Up
  { id: "EG-HU-1", driver: "Hurry Up", cluster: "Multitasking", tekst: "Ik beheer meerdere taken tegelijk en vind daarin een meerwaarde." },
  { id: "EG-HU-2", driver: "Hurry Up", cluster: "Werktempo", tekst: "Ik werk snel en productief, ook onder tijdsdruk." },
  { id: "EG-HU-3", driver: "Hurry Up", cluster: "Momentum", tekst: "Ik ga liever snel vooruit dan lang te wachten op perfectie." },
  { id: "EG-HU-4", driver: "Hurry Up", cluster: "Activatienood", tekst: "Ik heb een hoog activatieniveau nodig om op mijn best te functioneren." },
  { id: "EG-HU-5", driver: "Hurry Up", cluster: "Actiegerichtheid", tekst: "Rust voelt voor mij onproductief; ik wil altijd bezig zijn." },
  // Try Hard
  { id: "EG-TH-1", driver: "Try Hard", cluster: "Prestatiedrang", tekst: "Ik stel hoge doelen en zet me voluit in om ze te bereiken." },
  { id: "EG-TH-2", driver: "Try Hard", cluster: "Bewijsdrang", tekst: "Ik voel me aangedreven om mijn waarde te bewijzen in uitdagende situaties." },
  { id: "EG-TH-3", driver: "Try Hard", cluster: "Volharding", tekst: "Ik geef niet snel op en blijf doorzetten tot het gewenste resultaat er is." },
  { id: "EG-TH-4", driver: "Try Hard", cluster: "Uitdagingsdrang", tekst: "Ik gedij het best in veeleisende omgevingen waar ik mezelf moet overstijgen." },
  { id: "EG-TH-5", driver: "Try Hard", cluster: "Ambitie", tekst: "Succes en erkenning voor mijn inzet zijn voor mij een sterke motor." },
  // Please Others
  { id: "EG-PO-1", driver: "Please Others", cluster: "Dienstbaarheid", tekst: "Ik ben sterk gericht op de noden en wensen van anderen." },
  { id: "EG-PO-2", driver: "Please Others", cluster: "Harmonie", tekst: "Ik zoek actief naar aanvaarding en wil disharmonie vermijden." },
  { id: "EG-PO-3", driver: "Please Others", cluster: "Diplomatisch", tekst: "Ik formuleer feedback op een manier die anderen kan aanvaarden." },
  { id: "EG-PO-4", driver: "Please Others", cluster: "Empathie", tekst: "Ik voel snel aan hoe anderen zich voelen en pas mijn gedrag daarop aan." },
  { id: "EG-PO-5", driver: "Please Others", cluster: "Aanpassingsbereidheid", tekst: "Ik pas mijn werkstijl aan anderen aan om samenwerking te bevorderen." },
  // Energiebalans (open)
  { id: "EG-OPN-1", driver: "Energiebalans", cluster: "Open reflectie", tekst: "Welke activiteiten of werksituaties geven jou structureel energie? (open vraag)" },
  { id: "EG-OPN-2", driver: "Energiebalans", cluster: "Open reflectie", tekst: "Welke activiteiten of werksituaties kosten jou structureel energie? (open vraag)" },
];

function laad2MinScanItems(): VraagItem[] {
  return TWOMINSCAN_ITEMS_DEF.map((d) => ({
    itemId: d.id,
    instrument: "tapas-2minscan",
    family: d.driver,
    construct: d.cluster,
    tekst: { nl: d.tekst },
    heeftOverride: false,
  }));
}

/**
 * T4Students / Studiekompas — oriënterende studiekeuze voor jongeren.
 * Structuur: talentfoci (4) × 2 items + drivers (5) × 2 items + versnellers (6) × 2 items
 *            + motivatielagen (intrinsiek/extrinsiek) + 2 open vragen = 36 items.
 * Geen apart JSON-bestand — definities zijn normatief vastgelegd.
 * family = domein (foci / drivers / versnellers / motivatie)
 */
const T4STUDENTS_ITEMS_DEF: { id: string; domein: string; cluster: string; tekst: string }[] = [
  // Talentfoci
  { id: "T4S-FA-1", domein: "Talentfoci", cluster: "Interrelatie", tekst: "Ik ga graag met mensen om en voel goed aan hoe zij zich voelen." },
  { id: "T4S-FA-2", domein: "Talentfoci", cluster: "Interrelatie", tekst: "Samenwerken en contacten leggen gaat me van nature gemakkelijk af." },
  { id: "T4S-FB-1", domein: "Talentfoci", cluster: "Operatie", tekst: "Ik zet ideeën vlot om in concrete acties en resultaten." },
  { id: "T4S-FB-2", domein: "Talentfoci", cluster: "Operatie", tekst: "Ik hou van praktisch werken en problemen oplossen met daadkracht." },
  { id: "T4S-FC-1", domein: "Talentfoci", cluster: "Strategie", tekst: "Ik kijk graag verder dan het hier en nu en bedenk langetermijndoelen." },
  { id: "T4S-FC-2", domein: "Talentfoci", cluster: "Strategie", tekst: "Ik ben goed in het zien van grote lijnen en het organiseren van complexe informatie." },
  { id: "T4S-FD-1", domein: "Talentfoci", cluster: "Innovatie", tekst: "Ik bedenk graag nieuwe ideeën en ongewone oplossingen." },
  { id: "T4S-FD-2", domein: "Talentfoci", cluster: "Innovatie", tekst: "Ik inspireer anderen met mijn creativiteit en origineel denken." },
  // Drivers
  { id: "T4S-DBS-1", domein: "Drivers", cluster: "Be Strong", tekst: "Ik werk het liefst zelfstandig en neem graag zelf de verantwoordelijkheid." },
  { id: "T4S-DBS-2", domein: "Drivers", cluster: "Be Strong", tekst: "Ik blijf rustig en gefocust als het moeilijk wordt." },
  { id: "T4S-DBP-1", domein: "Drivers", cluster: "Be Perfect", tekst: "Ik lever liever iets laat en goed af dan snel maar onvolledig." },
  { id: "T4S-DBP-2", domein: "Drivers", cluster: "Be Perfect", tekst: "Ik let op details en word onrustig als er fouten in mijn werk zitten." },
  { id: "T4S-DHU-1", domein: "Drivers", cluster: "Hurry Up", tekst: "Ik werk beter met een deadline dan zonder tijdsdruk." },
  { id: "T4S-DHU-2", domein: "Drivers", cluster: "Hurry Up", tekst: "Ik vind het fijn om snel resultaat te zien van mijn inspanningen." },
  { id: "T4S-DTH-1", domein: "Drivers", cluster: "Try Hard", tekst: "Ik wil uitblinken en mijn inzet laten zien in uitdagende situaties." },
  { id: "T4S-DTH-2", domein: "Drivers", cluster: "Try Hard", tekst: "Ik geef alles om te slagen, ook als het moeilijk is." },
  { id: "T4S-DPO-1", domein: "Drivers", cluster: "Please Others", tekst: "Het is voor mij belangrijk dat anderen tevreden zijn met mijn werk." },
  { id: "T4S-DPO-2", domein: "Drivers", cluster: "Please Others", tekst: "Ik pas me graag aan de behoeften van anderen aan om samenwerking te bevorderen." },
  // Versnellers
  { id: "T4S-Va-1", domein: "Versnellers", cluster: "Analyse", tekst: "Ik analyseer graag complexe problemen en zoek naar oorzaken en verbanden." },
  { id: "T4S-Va-2", domein: "Versnellers", cluster: "Analyse", tekst: "Ik orden informatie logisch en redeneer systematisch." },
  { id: "T4S-Vb-1", domein: "Versnellers", cluster: "Coaching", tekst: "Ik help anderen graag groeien en stel de juiste vragen om inzicht te bieden." },
  { id: "T4S-Vb-2", domein: "Versnellers", cluster: "Coaching", tekst: "Ik ondersteun anderen geduldig en sensitief bij hun leerproces." },
  { id: "T4S-Vc-1", domein: "Versnellers", cluster: "Onderscheiden", tekst: "Ik formuleer graag een visie en breng negatief nieuws positief." },
  { id: "T4S-Vc-2", domein: "Versnellers", cluster: "Onderscheiden", tekst: "Mijn persoonlijke bijdrage is meetbaar en opvallend anders dan die van anderen." },
  { id: "T4S-Vd-1", domein: "Versnellers", cluster: "Faciliteren", tekst: "Ik begeleid groepen door verandering en breng mensen bij een gemeenschappelijk doel." },
  { id: "T4S-Vd-2", domein: "Versnellers", cluster: "Faciliteren", tekst: "Ik stem verschillen af en zorg voor verbinding in een team." },
  { id: "T4S-Ve-1", domein: "Versnellers", cluster: "Impacteren", tekst: "Ik heb een natuurlijk overwicht en breng mensen in beweging." },
  { id: "T4S-Ve-2", domein: "Versnellers", cluster: "Impacteren", tekst: "Anderen voelen mijn invloed en vertrouwen op mijn oordeel." },
  { id: "T4S-Vf-1", domein: "Versnellers", cluster: "Resultaat", tekst: "Ik maak af wat ik begin en lever tastbare resultaten." },
  { id: "T4S-Vf-2", domein: "Versnellers", cluster: "Resultaat", tekst: "Onder druk haal ik de beste resultaten met een doener-mentaliteit." },
  // Motivatielaag (SDT — Deci & Ryan)
  { id: "T4S-MOT-INT-1", domein: "Motivatie (intrinsiek)", cluster: "Autonomie", tekst: "Ik studeer het best als ik zelf mag kiezen hoe en wanneer ik iets aanpak." },
  { id: "T4S-MOT-INT-2", domein: "Motivatie (intrinsiek)", cluster: "Competentie", tekst: "Ik voel me gedreven als ik merk dat ik écht iets leer of beter word." },
  { id: "T4S-MOT-INT-3", domein: "Motivatie (intrinsiek)", cluster: "Verbondenheid", tekst: "Ik werk harder als ik me verbonden voel met de mensen om me heen." },
  { id: "T4S-MOT-EXT-1", domein: "Motivatie (extrinsiek)", cluster: "Erkenning", tekst: "Goede punten, prijzen of erkenning van anderen motiveren me sterk." },
  { id: "T4S-MOT-EXT-2", domein: "Motivatie (extrinsiek)", cluster: "Verwachting", tekst: "De verwachtingen van mijn omgeving (ouders, school) spelen een grote rol in mijn keuzes." },
  // Open reflectie
  { id: "T4S-OPN-1", domein: "Reflectie", cluster: "Open vraag", tekst: "Welke vakken of activiteiten geven jou energie en waarom?" },
  { id: "T4S-OPN-2", domein: "Reflectie", cluster: "Open vraag", tekst: "In welke situaties voel jij je het sterkst? Geef een voorbeeld." },
];

function laadT4StudentsItems(): VraagItem[] {
  return T4STUDENTS_ITEMS_DEF.map((d) => ({
    itemId: d.id,
    instrument: "tapas-t4students",
    family: d.domein,
    construct: d.cluster,
    tekst: { nl: d.tekst },
    heeftOverride: false,
  }));
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

const INSTRUMENT_LOADERS: Record<string, () => VraagItem[]> = {
  "tapas-t4p":          laadT4PItems,
  "tapas-teamscan":     laadTeamscanItems,
  "tapas-t4recruitment": laadT4RItems,
  "tapas-2minscan":     laad2MinScanItems,
  "tapas-t4students":   laadT4StudentsItems,
  "tapas-t4teens":      laadT4TeensItems,
};

const BEKENDE_INSTRUMENTEN = Object.keys(INSTRUMENT_LOADERS);

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
