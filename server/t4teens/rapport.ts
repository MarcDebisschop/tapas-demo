// ---------------------------------------------------------------------------
// T4Teens — rapport-inhoud + HTML (NIEUW, strikt additief).
//
// bouwT4TeensRapport(contract): RapportInhoud   (exact dezelfde vorm als
//   server/rapportgenerator.ts, zodat storage.genereerRapport de inhoud/HTML
//   naadloos wegschrijft en de bestaande rapport-weergave het toont).
// renderT4TeensHtml(inhoud): string             (zelfstandige, nette HTML).
//
// VASTE T4Teens-sectiestructuur (identiek voor elke invuller), gevuld uit het
// T4Teens-scoringscontract (buildT4TeensContract, leeftijd 16-21). Dit haalt
// T4Teens uit de generieke fallback: een eigen, herkenbare "Vonk"-layout i.p.v.
// het korte generieke rapport. "Drivers" (Taibi Kahler) blijft altijd "drivers".
//
// Jongvolwassen-toon: aanmoedigend, reflectief, nooit deterministisch advies.
// Wat af is: vaste layout + volledige inhoud uit het contract + PDF via de
// gedeelde HTML->PDF-laag. Wat nog verfijning vergt: FR/EN-vertaling en een
// rijkere, per-cluster narratieve duiding (nu compacte, generieke duidingszinnen).
// ---------------------------------------------------------------------------

import type { RapportInhoud, RapportSectie } from "../rapportgenerator";
import { T4TEENS_FAMILIES } from "./scoring";

interface ConstructRowLike {
  construct: string;
  family: string;
  most: number;
  least: number;
  net: number;
  shown: number;
  avgEnergy: number;
  mostItems?: string[];
}

function num(x: unknown, fallback = 0): number {
  return typeof x === "number" && isFinite(x) ? x : fallback;
}

// Duidingslabel voor een gemiddelde item-score op -2..+2 (jongeren-toon).
function scoreLabel(avg: number): string {
  if (avg >= 1) return "heel herkenbaar";
  if (avg >= 0.25) return "herkenbaar";
  if (avg > -0.25) return "soms wel, soms niet";
  if (avg > -1) return "minder herkenbaar";
  return "niet echt herkenbaar";
}

function clustersVan(rows: ConstructRowLike[], family: string): ConstructRowLike[] {
  return rows
    .filter((r) => r.family === family)
    .sort((a, b) => num(b.avgEnergy) - num(a.avgEnergy));
}

function lijst(namen: string[]): string {
  if (namen.length === 0) return "";
  if (namen.length === 1) return namen[0];
  return namen.slice(0, -1).join(", ") + " en " + namen[namen.length - 1];
}

// Batterij (-2..+2) omzetten naar een korte, herkenbare zin.
function batterijZin(b: number | null): string {
  if (b === null) return "Je gaf niet aan hoe vol je batterij vandaag zit.";
  if (b >= 1) return "Je batterij zit vandaag goed vol — er is veel energie om mee aan de slag te gaan.";
  if (b >= 0) return "Je batterij zit vandaag redelijk op peil.";
  if (b > -1) return "Je batterij is vandaag wat lager dan gewoonlijk — dat mag, het is een momentopname.";
  return "Je batterij zit vandaag bijna leeg. Wees mild voor jezelf; dit zegt iets over vandaag, niet over wie je bent.";
}

export function bouwT4TeensRapport(contract: any): RapportInhoud {
  const p = contract?.participant ?? {};
  const main = contract?.sections?.main ?? {};
  const meta = main?.meta ?? {};
  const rows: ConstructRowLike[] = Array.isArray(main?.constructRows) ? main.constructRows : [];

  const drivers = clustersVan(rows, T4TEENS_FAMILIES.drivers);
  const versnellers = clustersVan(rows, T4TEENS_FAMILIES.versnellers);
  const foci = clustersVan(rows, T4TEENS_FAMILIES.foci);
  const interesse = clustersVan(rows, T4TEENS_FAMILIES.interesse);
  const betekenis = clustersVan(rows, T4TEENS_FAMILIES.betekenis);

  const secties: RapportSectie[] = [];

  // 1. Cover / inleiding.
  secties.push({
    kop: "Over jouw Vonk",
    paragrafen: [
      "Dit is jouw persoonlijke Vonk-rapport. Het laat zien — op basis van je eigen antwoorden — waar " +
        "jouw energie naartoe gaat, welke patronen je gedrag sturen, hoe je je talenten inzet, wat je " +
        "boeit en waar je iets zou willen betekenen.",
      "Er zijn geen goede of foute uitkomsten. Zie het als een spiegel en een startpunt voor een gesprek " +
        "over wie je bent en wat bij je past — niet als een test die je vastlegt.",
    ],
  });

  // 2. Energie / batterij (momentopname).
  secties.push({
    kop: "Je batterij — hoe je er vandaag bij zit",
    paragrafen: [
      batterijZin(meta?.batterij ?? null),
      "Je energieniveau schommelt van dag tot dag. Het helpt om te weten wat jouw batterij oplaadt en " +
        "wat hem leegtrekt.",
    ],
  });

  // 3. Drivers (Kahler) — met rem/gaspedaal-duiding. Label blijft "drivers".
  const topDrivers = drivers.filter((r) => num(r.avgEnergy) > 0).slice(0, 2);
  const remDrivers = [...drivers].filter((r) => num(r.avgEnergy) < 0);
  secties.push({
    kop: "Drivers — patronen die je aansturen",
    paragrafen: [
      "Drivers zijn onbewuste, aangeleerde patronen (naar Taibi Kahler) die je gedrag kunnen sturen, " +
        "vooral onder druk. Ze zijn niet goed of slecht: soms werken ze als gaspedaal (ze geven je energie " +
        "en richting), soms als rem (ze vragen aandacht en kunnen je tegenhouden).",
      topDrivers.length
        ? "Bij jou komen vooral " +
          lijst(topDrivers.map((r) => r.construct)) +
          " naar voren. Die werken voor jou vaak als gaspedaal. Let op het moment waarop ze te sterk gaan " +
          "duwen (bv. alles perfect willen of jezelf wegcijferen)."
        : "Er sprong geen enkele driver er duidelijk uit — je patronen zijn redelijk in balans.",
      remDrivers.length
        ? "Deze herken je minder of ervaar je eerder als rem: " +
          lijst(remDrivers.map((r) => r.construct)) +
          ". Dat zijn geen zwaktes, maar plekken waar wat bewuste aandacht je kan helpen."
        : "Geen enkele driver werkte duidelijk als rem voor jou.",
    ],
    tabel: drivers.length
      ? {
          kolommen: ["Driver", "Gemiddelde score", "Werking"],
          rijen: drivers.map((r) => [
            r.construct,
            num(r.avgEnergy),
            num(r.avgEnergy) >= 0 ? "eerder gaspedaal" : "eerder rem",
          ]),
        }
      : undefined,
  });

  // 4. Talent-versnellers.
  secties.push({
    kop: "Talent-versnellers — hoe jij je talent inzet",
    paragrafen: [
      versnellers.length
        ? "Talent-versnellers laten zien hoe jouw talent het best tot z'n recht komt. Jij herkent vooral: " +
          lijst(versnellers.filter((r) => num(r.avgEnergy) > 0).map((r) => r.construct)) +
          "."
        : "Er zijn nog te weinig antwoorden om je talent-versnellers te duiden.",
    ],
    tabel: versnellers.length
      ? {
          kolommen: ["Versneller", "Gemiddelde score", "Herkenbaarheid"],
          rijen: versnellers.map((r) => [r.construct, num(r.avgEnergy), scoreLabel(num(r.avgEnergy))]),
        }
      : undefined,
  });

  // 5. Talent-foci — waar je energie naartoe stroomt.
  secties.push({
    kop: "Talent-foci — waar je energie naartoe gaat",
    paragrafen: [
      foci.length
        ? "Je talent-foci beschrijven het soort werk waar je van nature energie van krijgt. Jouw sterkst " +
          "herkende foci zijn: " +
          lijst(foci.filter((r) => num(r.avgEnergy) > 0).map((r) => r.construct)) +
          "."
        : "Er zijn nog te weinig antwoorden om je talent-foci te duiden.",
    ],
    tabel: foci.length
      ? {
          kolommen: ["Talent-focus", "Gemiddelde score", "Herkenbaarheid"],
          rijen: foci.map((r) => [r.construct, num(r.avgEnergy), scoreLabel(num(r.avgEnergy))]),
        }
      : undefined,
  });

  // 6. Interesse (RIASEC).
  secties.push({
    kop: "Interesses — wat je aantrekt",
    paragrafen: [
      interesse.length
        ? "Deze interessegebieden (gebaseerd op het RIASEC-model) laten zien welk soort activiteiten je " +
          "aantrekken. Jij voelt je vooral aangetrokken tot: " +
          lijst(interesse.filter((r) => num(r.avgEnergy) > 0).map((r) => r.construct)) +
          ". Dit kan een aanwijzing zijn voor studie- of werkrichtingen die bij je passen — een startpunt, " +
          "geen voorschrift."
        : "Er zijn nog te weinig antwoorden om je interesses te duiden.",
    ],
    tabel: interesse.length
      ? {
          kolommen: ["Interessegebied", "Gemiddelde score", "Herkenbaarheid"],
          rijen: interesse.map((r) => [r.construct, num(r.avgEnergy), scoreLabel(num(r.avgEnergy))]),
        }
      : undefined,
  });

  // 7. Betekenis.
  const betekenisScore = betekenis.length ? num(betekenis[0].avgEnergy) : null;
  secties.push({
    kop: "Betekenis — waar je iets wil betekenen",
    paragrafen: [
      betekenisScore !== null
        ? "Iets betekenen voor anderen of voor de wereld is voor jou " +
          scoreLabel(betekenisScore) +
          ". Nadenken over waar jij het verschil wil maken, geeft richting aan je keuzes."
        : "Er zijn nog te weinig antwoorden om je gevoel voor betekenis te duiden.",
      "Neem deze inzichten mee in een gesprek met iemand die je vertrouwt — een coach, leerkracht of " +
        "ouder — en toets ze aan je eigen ervaringen.",
    ],
  });

  return {
    variant: "kompas",
    taal: "nl",
    titel: "T4Teens — Ontdek jouw Vonk",
    ondertitel: "Jouw talent-, energie- en gedragsprofiel (16-21 jaar)",
    respondent: {
      naam: p.name ?? "Onbekend",
      code: p.respondentCode ?? "—",
      organisatie: p.company ?? null,
      functie: p.role ?? null,
    },
    gegenereerdOp: new Date().toISOString(),
    secties,
    disclaimer:
      "Dit Vonk-rapport beschrijft talent, energie, drivers en interesses op basis van je eigen antwoorden. " +
      "Het is een momentopname en geen psychologische diagnose, geen meting van intelligentie of " +
      "potentieel, en geen selectie-instrument. Gebruik het als een aanmoedigend startpunt voor reflectie " +
      "en gesprek — niet als een keuze die vastligt.",
  };
}

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderT4TeensHtml(inhoud: RapportInhoud): string {
  const r = inhoud.respondent;
  const metaRegel = [r.organisatie, r.functie].filter(Boolean).join(" · ");
  const sectiesHtml = inhoud.secties
    .map((s) => {
      const paras = s.paragrafen.map((p) => `<p>${esc(p)}</p>`).join("\n");
      let tabel = "";
      if (s.tabel) {
        const th = s.tabel.kolommen.map((kk) => `<th>${esc(kk)}</th>`).join("");
        const rows = s.tabel.rijen
          .map((row) => `<tr>${row.map((c) => `<td>${esc(String(c))}</td>`).join("")}</tr>`)
          .join("\n");
        tabel = `<table><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table>`;
      }
      return `<section><h2>${esc(s.kop)}</h2>${paras}${tabel}</section>`;
    })
    .join("\n");

  const datum = new Date(inhoud.gegenereerdOp).toLocaleString("nl-BE");

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8" />
<title>${esc(inhoud.titel)} — ${esc(r.naam)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
  :root {
    --plum: #7c3aed; --coral: #f97316; --ink: #0f172a; --muted: #64748b;
    --muted-light: #94a3b8; --line: #e2e8f0; --surface: #f8fafc; --white: #ffffff;
  }
  * { box-sizing: border-box; }
  body {
    font-family: 'DM Sans', 'Segoe UI', system-ui, -apple-system, Arial, sans-serif;
    color: var(--ink); margin: 0; padding: 32px; background: var(--surface);
    -webkit-font-smoothing: antialiased;
  }
  .doc {
    max-width: 760px; margin: 0 auto; background: var(--white);
    border: 1px solid var(--line); border-radius: 14px; overflow: hidden;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  }
  .doc-header {
    background: linear-gradient(135deg, var(--plum) 0%, var(--coral) 100%);
    padding: 32px 40px 24px; position: relative; overflow: hidden;
  }
  .brand-mark { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 16px; }
  .brand-mark-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.9); }
  .brand-mark-name {
    font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
    color: rgba(255,255,255,0.85);
  }
  h1 { font-size: 22px; font-weight: 700; margin: 0 0 4px; color: var(--white); line-height: 1.25; }
  .sub { color: rgba(255,255,255,0.85); font-size: 14px; margin: 0; font-weight: 400; }
  .resp {
    margin-top: 14px; font-size: 13px; color: rgba(255,255,255,0.95);
    background: rgba(255,255,255,0.15); border-radius: 6px; padding: 8px 12px; display: inline-block;
  }
  .resp strong { font-weight: 600; color: var(--white); }
  .doc-body { padding: 36px 40px 32px; }
  h2 {
    font-size: 15px; font-weight: 600; color: var(--plum); margin: 28px 0 8px;
    padding-bottom: 6px; border-bottom: 2px solid var(--line);
    display: flex; align-items: center; gap: 6px;
  }
  h2::before {
    content: ''; display: inline-block; width: 4px; height: 14px;
    background: var(--coral); border-radius: 2px; flex-shrink: 0;
  }
  p { font-size: 14px; line-height: 1.7; margin: 0 0 10px; color: var(--ink); }
  table {
    width: 100%; border-collapse: collapse; margin: 14px 0 6px; font-size: 13px;
    border-radius: 8px; overflow: hidden; border: 1px solid var(--line);
  }
  thead tr { background: linear-gradient(to right, var(--plum), #a855f7); }
  th {
    color: rgba(255,255,255,0.95); font-weight: 600; font-size: 11px; letter-spacing: 0.05em;
    text-transform: uppercase; padding: 10px 12px; text-align: left;
  }
  td { text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--line); color: var(--ink); }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  tbody tr:last-child td { border-bottom: none; }
  .disclaimer {
    margin-top: 28px; padding: 14px 16px; background: #faf5ff; border-left: 3px solid var(--coral);
    border-radius: 0 8px 8px 0; font-size: 12px; color: var(--muted); line-height: 1.6;
  }
  .doc-footer {
    margin: 0; padding: 14px 40px; background: var(--surface); border-top: 1px solid var(--line);
    display: flex; align-items: center; justify-content: space-between; font-size: 11px;
    color: var(--muted-light);
  }
  .doc-footer-brand { font-weight: 600; color: var(--plum); letter-spacing: 0.04em; }
  section { page-break-inside: avoid; }
</style>
</head>
<body>
  <div class="doc">
    <div class="doc-header">
      <div class="brand-mark">
        <span class="brand-mark-dot"></span>
        <span class="brand-mark-name">TaPasCity · T4Teens</span>
      </div>
      <h1>${esc(inhoud.titel)}</h1>
      <p class="sub">${esc(inhoud.ondertitel)}</p>
      <p class="resp"><strong>${esc(r.naam)}</strong> · ${esc(r.code)}${metaRegel ? " · " + esc(metaRegel) : ""}</p>
    </div>
    <div class="doc-body">
      ${sectiesHtml}
      <div class="disclaimer">${esc(inhoud.disclaimer)}</div>
    </div>
    <div class="doc-footer">
      <span>Gegenereerd op ${esc(datum)}</span>
      <span class="doc-footer-brand">TaPasCity · TaPas Platform</span>
    </div>
  </div>
</body>
</html>`;
}
