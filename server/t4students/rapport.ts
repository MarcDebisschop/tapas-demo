// ---------------------------------------------------------------------------
// T4Students — rapport-inhoud + HTML (NIEUW, strikt additief).
//
// bouwT4StudentsRapport(contract): RapportInhoud   (exact dezelfde vorm als
//   server/rapportgenerator.ts, zodat storage.genereerRapport de inhoud/HTML
//   naadloos kan wegschrijven en de bestaande, instrument-agnostische
//   rapport-weergave (/api/rapporten/:id/html) het toont).
// renderT4StudentsHtml(inhoud): string             (zelfstandige, nette HTML).
//
// FASE 1: NL only, HTML only. Geen PDF, geen FR/EN, Deep-Dive als KORTE
// oriënterende basissectie. Reflectief geformuleerd — nooit deterministisch
// studieadvies. "Drivers" (Taibi Kahler) blijft altijd "drivers".
// ---------------------------------------------------------------------------

import type { RapportInhoud, RapportSectie } from "../rapportgenerator";
import { T4S_FAMILIES } from "./scoring";

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

// Duidingslabel voor een gemiddelde item-score op -2..+2.
function scoreLabel(avg: number): string {
  if (avg >= 1) return "sterk herkenbaar";
  if (avg >= 0.25) return "herkenbaar";
  if (avg > -0.25) return "wisselend";
  if (avg > -1) return "minder herkenbaar";
  return "weinig herkenbaar";
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

export function bouwT4StudentsRapport(contract: any): RapportInhoud {
  const p = contract?.participant ?? {};
  const main = contract?.sections?.main ?? {};
  const meta = main?.meta ?? {};
  const rows: ConstructRowLike[] = Array.isArray(main?.constructRows) ? main.constructRows : [];
  const reflectie: { itemId: string; vraag: string; antwoord: string }[] =
    contract?.sections?.reflectie?.antwoorden ?? [];

  const talentfoci = clustersVan(rows, T4S_FAMILIES.talentfoci);
  const drivers = clustersVan(rows, T4S_FAMILIES.drivers);
  const versnellers = clustersVan(rows, T4S_FAMILIES.versnellers);

  const secties: RapportSectie[] = [];

  // 1. Cover / inleiding.
  secties.push({
    kop: "Over dit studiekompas",
    paragrafen: [
      "Dit rapport is een oriënterend studiekompas. Het beschrijft — op basis van je eigen keuzes — " +
        "waar je energie naartoe stroomt, welke onbewuste drivers je gedrag kunnen sturen, welke talent" +
        "versnellers je herkent en wat je motiveert om te studeren.",
      "Het is uitdrukkelijk géén selectie- of diagnose-instrument en geeft geen deterministisch " +
        "studieadvies. Zie het als een startpunt voor reflectie en gesprek over je studiekeuze.",
    ],
  });

  // 2. Talentfoci (4 clusters).
  secties.push({
    kop: "Talentfoci — waar je energie naartoe stroomt",
    paragrafen: [
      talentfoci.length
        ? "De vier talentfoci beschrijven verschillende manieren waarop je van nature energie richt. " +
          "Je sterkst herkende foci zijn: " +
          lijst(talentfoci.filter((r) => num(r.avgEnergy) > 0).map((r) => r.construct)) +
          "." +
          " Deze gebieden voelen doorgaans het meest natuurlijk aan."
        : "Er zijn nog onvoldoende antwoorden om de talentfoci te duiden.",
    ],
    tabel: talentfoci.length
      ? {
          kolommen: ["Talentfocus", "Gemiddelde score", "Herkenbaarheid"],
          rijen: talentfoci.map((r) => [r.construct, num(r.avgEnergy), scoreLabel(num(r.avgEnergy))]),
        }
      : undefined,
  });

  // 3. Drivers (Kahler) — met rem/gaspedaal-duiding. Label blijft "drivers".
  const topDrivers = drivers.filter((r) => num(r.avgEnergy) > 0).slice(0, 2);
  const remDrivers = [...drivers].filter((r) => num(r.avgEnergy) < 0);
  secties.push({
    kop: "Drivers",
    paragrafen: [
      "De term drivers verwijst naar onbewuste, aangeleerde mechanismen (naar Taibi Kahler) die je " +
        "gedrag onder druk kunnen aansturen. Ze zijn niet goed of slecht: ze kunnen als gaspedaal " +
        "werken (ze geven richting en energie) of als rem (ze vragen aandacht en kunnen je afremmen).",
      topDrivers.length
        ? "Je sterkst aanwezige drivers zijn " +
          lijst(topDrivers.map((r) => r.construct)) +
          ". Deze werken voor jou vooral als gaspedaal: ze zetten je in beweging. Wees je bewust van " +
          "de mogelijke valkuil wanneer ze te sterk gaan sturen (bv. overmatig streven of aanpassen)."
        : "Er kwamen geen sterk uitgesproken drivers naar voren.",
      remDrivers.length
        ? "De volgende drivers herken je minder of ervaar je eerder als rem: " +
          lijst(remDrivers.map((r) => r.construct)) +
          ". Dit zijn geen tekortkomingen, maar plekken waar bewuste aandacht kan helpen."
        : "Er kwamen geen drivers naar voren die duidelijk als rem werken.",
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

  // 4. Talentversnellers (6 clusters).
  secties.push({
    kop: "Talentversnellers — hoe je je talenten inzet",
    paragrafen: [
      versnellers.length
        ? "De talentversnellers beschrijven concrete manieren waarop je talenten tot hun recht komen. " +
          "Je herkent vooral: " +
          lijst(versnellers.filter((r) => num(r.avgEnergy) > 0).map((r) => r.construct)) +
          "."
        : "Er zijn nog onvoldoende antwoorden om de talentversnellers te duiden.",
    ],
    tabel: versnellers.length
      ? {
          kolommen: ["Versneller", "Gemiddelde score", "Herkenbaarheid"],
          rijen: versnellers.map((r) => [r.construct, num(r.avgEnergy), scoreLabel(num(r.avgEnergy))]),
        }
      : undefined,
  });

  // 5. Motivatieprofiel — intrinsiek vs extrinsiek (SDT, Deci & Ryan).
  const intr = num(meta?.motivatie?.intrinsiek);
  const extr = num(meta?.motivatie?.extrinsiek);
  const balans = String(meta?.motivatie?.balansLabel ?? "evenwichtig");
  const balansZin =
    balans === "intrinsiek"
      ? "Je motivatie leunt vooral naar de intrinsieke kant: je studeert het best vanuit eigen keuze, " +
        "het gevoel te groeien en verbondenheid met anderen."
      : balans === "extrinsiek"
      ? "Je motivatie leunt vooral naar de extrinsieke kant: erkenning, punten en de verwachtingen van " +
        "je omgeving spelen een grote rol. Dat kan sterk motiveren, maar is gevoeliger voor externe druk."
      : "Je motivatie is relatief evenwichtig verdeeld over intrinsieke en extrinsieke bronnen.";
  secties.push({
    kop: "Motivatieprofiel — wat je drijft om te studeren",
    paragrafen: [
      "Volgens de zelfdeterminatietheorie (Deci & Ryan) komt motivatie uit intrinsieke bronnen " +
        "(autonomie, competentie, verbondenheid) en extrinsieke bronnen (erkenning, verwachtingen). " +
        balansZin,
      "Beide vormen zijn waardevol. Bewustzijn van je balans helpt je omgevingen te kiezen waarin je " +
        "motivatie duurzaam blijft.",
    ],
    tabel: {
      kolommen: ["Motivatiebron", "Gemiddelde score"],
      rijen: [
        ["Intrinsiek", intr],
        ["Extrinsiek", extr],
      ],
    },
  });

  // 6. Deep-Dive & studierichting-denkspoor (KORTE oriënterende basissectie).
  const denkspoor: string[] = [
    "Onderstaand denkspoor is oriënterend en indicatief — het benoemt richtingen die passen bij je " +
      "profiel, maar schrijft geen keuze voor. Gebruik het als voer voor gesprek, niet als beslissing.",
  ];
  const sterkeFoci = talentfoci.filter((r) => num(r.avgEnergy) > 0).map((r) => r.construct);
  if (sterkeFoci.length) {
    denkspoor.push(
      "Je sterkste talentfoci (" +
        lijst(sterkeFoci) +
        ") kunnen wijzen op studiecontexten waarin dit soort werk centraal staat. Dit kan een aanwijzing " +
        "zijn, geen voorschrift."
    );
  }
  for (const a of reflectie) {
    denkspoor.push(
      "Op de vraag “" + a.vraag + "” gaf je aan: " + (a.antwoord ? "“" + a.antwoord + "”" : "(niet beantwoord)")
    );
  }
  denkspoor.push(
    "Neem deze inzichten mee in een gesprek met een studiekeuzebegeleider en toets ze aan open" +
      "dagen, proeflessen en je eigen ervaringen."
  );
  secties.push({
    kop: "Deep-Dive & studierichting — een oriënterend denkspoor",
    paragrafen: denkspoor,
  });

  return {
    variant: "kompas",
    taal: "nl",
    titel: "T4Students Studiekompas",
    ondertitel: "Oriënterend talent-, driver- en motivatieprofiel voor je studiekeuze",
    respondent: {
      naam: p.name ?? "Onbekend",
      code: p.respondentCode ?? "—",
      organisatie: p.company ?? null,
      functie: p.role ?? null,
    },
    gegenereerdOp: new Date().toISOString(),
    secties,
    disclaimer:
      "Dit studiekompas beschrijft talent, drivers en motivatie op basis van zelfgerapporteerde keuzes. " +
      "Het is een momentopname en geen psychologische diagnose, geen meting van intelligentie of " +
      "potentieel, en geen selectie-instrument. Het is bedoeld als oriënterend startpunt voor reflectie " +
      "en gesprek over je studiekeuze — niet als een deterministisch studieadvies.",
  };
}

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderT4StudentsHtml(inhoud: RapportInhoud): string {
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
    --navy: #1e293b; --teal: #0d9488; --ink: #0f172a; --muted: #64748b;
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
    background: linear-gradient(135deg, var(--teal) 0%, var(--navy) 100%);
    padding: 32px 40px 24px; position: relative; overflow: hidden;
  }
  .brand-mark { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 16px; }
  .brand-mark-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.9); }
  .brand-mark-name {
    font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
    color: rgba(255,255,255,0.85);
  }
  h1 { font-size: 22px; font-weight: 700; margin: 0 0 4px; color: var(--white); line-height: 1.25; }
  .sub { color: rgba(255,255,255,0.75); font-size: 14px; margin: 0; font-weight: 400; }
  .resp {
    margin-top: 14px; font-size: 13px; color: rgba(255,255,255,0.9);
    background: rgba(255,255,255,0.1); border-radius: 6px; padding: 8px 12px; display: inline-block;
  }
  .resp strong { font-weight: 600; color: var(--white); }
  .doc-body { padding: 36px 40px 32px; }
  h2 {
    font-size: 15px; font-weight: 600; color: var(--navy); margin: 28px 0 8px;
    padding-bottom: 6px; border-bottom: 2px solid var(--line);
    display: flex; align-items: center; gap: 6px;
  }
  h2::before {
    content: ''; display: inline-block; width: 4px; height: 14px;
    background: var(--teal); border-radius: 2px; flex-shrink: 0;
  }
  p { font-size: 14px; line-height: 1.7; margin: 0 0 10px; color: var(--ink); }
  table {
    width: 100%; border-collapse: collapse; margin: 14px 0 6px; font-size: 13px;
    border-radius: 8px; overflow: hidden; border: 1px solid var(--line);
  }
  thead tr { background: linear-gradient(to right, var(--navy), #334155); }
  th {
    color: rgba(255,255,255,0.9); font-weight: 600; font-size: 11px; letter-spacing: 0.05em;
    text-transform: uppercase; padding: 10px 12px; text-align: left;
  }
  td { text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--line); color: var(--ink); }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  tbody tr:last-child td { border-bottom: none; }
  .disclaimer {
    margin-top: 28px; padding: 14px 16px; background: #f1f5f9; border-left: 3px solid var(--teal);
    border-radius: 0 8px 8px 0; font-size: 12px; color: var(--muted); line-height: 1.6;
  }
  .doc-footer {
    margin: 0; padding: 14px 40px; background: var(--surface); border-top: 1px solid var(--line);
    display: flex; align-items: center; justify-content: space-between; font-size: 11px;
    color: var(--muted-light);
  }
  .doc-footer-brand { font-weight: 600; color: var(--teal); letter-spacing: 0.04em; }
  section { page-break-inside: avoid; }
</style>
</head>
<body>
  <div class="doc">
    <div class="doc-header">
      <div class="brand-mark">
        <span class="brand-mark-dot"></span>
        <span class="brand-mark-name">TaPasCity</span>
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
